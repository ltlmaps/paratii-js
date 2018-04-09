/* global File, ArrayBuffer */
'use strict'

import { ipfsSchema } from './schemas.js'
import { EventEmitter } from 'events'
import joi from 'joi'
const pull = require('pull-stream')
const pullFilereader = require('pull-filereader')
const toPull = require('stream-to-pull-stream')
const fs = require('fs')
const path = require('path')
const { eachSeries, nextTick } = require('async')
const once = require('once')
const Multiaddr = require('multiaddr')
const Resumable = require('resumablejs')

/**
 * IPFS UPLOADER : Paratii IPFS uploader interface.
 * @extends EventEmitter
 * @param {ParatiiIPFSUploaderSchema} opts
 */
export class Uploader extends EventEmitter {
  /**
  * @typedef {Array} ParatiiIPFSUploaderSchema
  * @property {?ipfsSchema} ipfs
  * @property {?Object} ParatiiIPFS
  */
  constructor (opts) {
    super()
    const schema = joi.object({
      ipfs: ipfsSchema,
      paratiiIPFS: joi.object().optional()
    //   onReadyHook: joi.array().ordered().default([]),
    //   protocol: joi.string().default(null),
    })
    const result = joi.validate(opts, schema, {allowUnknown: true})
    if (result.error) throw result.error
    this.config = result.value
    this._ipfs = this.config.paratiiIPFS // this is the paratii.ipfs.js
  }

  /**
   * ????
   * @param  {?} ev ?
   * @return {?}    ?

   */
  onDrop (ev) {
  }

  /**
   * Upload a file over XHR to the transcoder. To be called with an event emitter as the last argument
   * @param  {Object} file       file to upload
   * @param  {string} hashedFile hash of the file ??
   * @param  {EventEmitter} ev         event emitter
   * @example this.xhrUpload(file, hashedFile, ev)

   */
  xhrUpload (file, hashedFile, ev) {
    let r = new Resumable({
      target: `${this.config.transcoderDropUrl}/${hashedFile.hash}`,
      chunkSize: this.config.ipfs.xhrChunkSize,
      simultaneousUploads: 4,
      testChunks: false,
      throttleProgressCallbacks: 1,
      maxFileSize: this.config.ipfs.maxFileSize
    })

    r.on('fileAdded', (file, ev) => {
      console.log('file ', file, 'added')
    })

    r.on('fileProgress', (file) => {
      ev.emit('progress', r.progress() * 100)
    })

    r.on('complete', () => {
      ev.emit('fileReady', hashedFile)
    })

    r.on('error', (err, file) => {
      console.error('file ', file, 'err ', err)
    })

    r.addFile(file._html5File)

    setTimeout(() => {
      r.upload()
    }, 1)
  }

  /**
   * uploads a single file to *local* IPFS node
   * @param {File} file HTML5 File Object.
   * @returns {EventEmitter} checkout the upload function below for details.
   * @example let uploaderEv = paratiiIPFS.uploader.add(files)

   */
  add (file) {
    let files
    if (Array.isArray(file)) {
      files = file
    } else {
      files = [file]
    }

    let result = []

    for (let i = 0; i < files.length; i++) {
      // check if File is actually available or not.
      // if not it means we're not in the browser land.
      if (typeof File !== 'undefined') {
        if (files[i] instanceof File) {
          result.push(this.html5FileToPull(files[i]))
        } else {
          result.push(this.fsFileToPull(files[i]))
        }
      } else {
        result.push(this.fsFileToPull(files[i]))
      }
    }
    return this.upload(result)
  }

  /**
   * returns a generic File Object with a Pull Stream from an HTML5 File
   * @param  {File} file  HTML5 File Object
   * @return {Object}      generic file object.
   * @example ?

   */
  html5FileToPull (file) {
    return {
      name: file.name,
      size: file.size,
      path: file.path,
      _html5File: file,
      _pullStream: pullFilereader(file)
    }
  }

  /**
   * returns a generic file Object from a file path
   * @param  {string} filePath Path to file.
   * @return {Object} generic file object.
   * @example ?

   */
  fsFileToPull (filePath) {
    let stats = fs.statSync(filePath)
    if (stats) {
      return {
        name: path.basename(filePath),
        size: stats.size,
        _pullStream: toPull(fs.createReadStream(filePath))
      }
    } else {
      return null
    }
  }

  /**
   * upload an Array of files as is to the local IPFS node
   * @param  {Array} files    HTML5 File Object Array.
   * @return {EventEmitter} returns EventEmitter with the following events:
   *    - 'start': uploader started.
   *    - 'progress': (chunkLength, progressPercent)
   *    - 'fileReady': (file) triggered when a file is uploaded locally.
   *    - 'done': (files) triggered when the uploader is done locally.
   *    - 'error': (err) triggered whenever an error occurs.
   * @example ?

   */
  upload (files) {
    let meta = {} // holds File metadata.
    let ev = new EventEmitter()

    this._ipfs.start().then(() => {
      // trigger onStart callback
      ev.emit('start')
      if (files && files[0] && files[0].size > this.config.ipfs.maxFileSize) {
        ev.emit('error', `file size is larger than the allowed ${this.config.ipfs.maxFileSize / 1024 / 1024}MB`)
        return
      }

      pull(
        pull.values(files),
        pull.through((file) => {
          this._ipfs.log('Adding ', file)
          meta.fileSize = file.size
          meta.total = 0
        }),
        pull.asyncMap((file, cb) => pull(
          pull.values([{
            path: file.name,
            // content: pullFilereader(file)
            content: pull(
              file._pullStream,
              pull.through((chunk) => ev.emit('progress2', chunk.length, Math.floor((meta.total += chunk.length) * 1.0 / meta.fileSize * 100)))
            )
          }]),
          this._node.files.addPullStream({chunkerOptions: {maxChunkSize: this.config.ipfs.chunkSize}}), // default size 262144
          pull.collect((err, res) => {
            if (err) {
              return ev.emit('error', err)
            }

            const hashedFile = res[0]
            this._ipfs.log('Adding %s finished as %s, size: %s', hashedFile.path, hashedFile.hash, hashedFile.size)

            if (file._html5File) {
              this.xhrUpload(file, hashedFile, ev)
            } else {
              ev.emit('fileReady', hashedFile)
            }

            cb(null, hashedFile)
          })
        )),
        pull.collect((err, hashedFiles) => {
          if (err) {
            ev.emit('error', err)
          }
          this._ipfs.log('uploader is DONE')
          ev.emit('done', hashedFiles)
        })
      )
    })

    return ev
  }

  /**
   * upload an entire directory to IPFS
   * @param  {string}   dirPath path to directory
   * @return {Promise}           returns the {multihash, path, size} for the uploaded folder.
   * @example ?

   */
  addDirectory (dirPath) {
    return new Promise((resolve, reject) => {
      // cb = once(cb)
      let resp = null
      // this._ipfs.log('adding ', dirPath, ' to IPFS')

      const addStream = this._node.files.addReadableStream()
      addStream.on('data', (file) => {
        // this._ipfs.log('dirPath ', dirPath)
        // this._ipfs.log('file Added ', file)
        if (file.path === dirPath) {
          // this._ipfs.log('this is the hash to return ')
          resp = file
          nextTick(() => resolve(resp))
        }
      })

      addStream.on('end', () => {
        // this._ipfs.log('addStream ended')
        // nextTick(() => cb(null, resp))
      })

      fs.readdir(dirPath, (err, files) => {
        if (err) return reject(err)
        eachSeries(files, (file, next) => {
          next = once(next)
          try {
            this._ipfs.log('reading file ', file)
            let rStream = fs.createReadStream(path.join(dirPath, file))
            rStream.on('error', (err) => {
              if (err) {
                this._ipfs.error('rStream Error ', err)
                return next()
              }
            })
            if (rStream) {
              addStream.write({
                path: path.join(dirPath, file),
                content: rStream
              })
            }
          } catch (e) {
            if (e) {
              this._ipfs.error('createReadStream Error: ', e)
            }
          } finally {
          }
          // next()
          nextTick(() => next())
        }, (err) => {
          if (err) return reject(err)
          // addStream.destroy()
          addStream.end()
        })
      })
    })
  }

  /**
   * signals transcoder(s) to transcode fileHash
   * @param  {string} fileHash IPFS file hash.
   * @param  {Object} options  ref: https://github.com/Paratii-Video/paratii-lib/blob/master/docs/paratii-ipfs.md#ipfsuploadertranscodefilehash-options
   * @return {EventEmitter} returns EventEmitter with the following events:
   *    - 'uploader:progress': (hash, chunkSize, percent) client to transcoder upload progress.
   *    - 'transcoding:started': (hash, author)
   *    - 'transcoding:progress': (hash, size, percent)
   *    - 'transcoding:downsample:ready' (hash, size)
   *    - 'transcoding:done': (hash, transcoderResult) triggered when the transcoder is done - returns the hash of the transcoded file
   *    - 'transcoder:error': (err) triggered whenever an error occurs.
   * @example ?

   */
  transcode (fileHash, options) {
    const schema = joi.object({
      author: joi.string().default('0x'), // ETH/PTI address of the file owner
      transcoder: joi.string().default(this.config.ipfs.defaultTranscoder),
      transcoderId: joi.any().default(Multiaddr(this.config.ipfs.defaultTranscoder).getPeerId())
    }).unknown()

    this._ipfs.log('Signaling transcoder...')

    const result = joi.validate(options, schema)
    const error = result.error
    if (error) throw error
    let opts = result.value

    let ev
    if (opts.ev) {
      ev = opts.ev
    } else {
      ev = new EventEmitter()
    }

    if (fileHash === '') {
      // empty hash for testing eventemitter
      ev.emit('transcoding:done', {test: 1})
      return ev
    }
    let msg = this._ipfs.protocol.createCommand('transcode', {hash: fileHash, author: opts.author, size: opts.size})
    // FIXME : This is for dev, so we just signal our transcoder node.
    // This needs to be dynamic later on.
    this._node.swarm.connect(opts.transcoder, (err, success) => {
      if (err) return ev.emit('transcoding:error', err)

      opts.transcoderId = opts.transcoderId || Multiaddr(opts.transcoder).getPeerId()
      this._ipfs.log('transcoderId: ', opts.transcoderId)
      this._node.swarm.peers((err, peers) => {
        this._ipfs.log('peers: ', peers)
        if (err) return ev.emit('transcoding:error', err)
        peers.map((peer) => {
          try {
            this._ipfs.log('peerID : ', peer.peer.toB58String(), opts.transcoderId, peer.peer.toB58String() === opts.transcoder)
            if (peer.peer.toB58String() === opts.transcoderId) {
              this._ipfs.log(`sending transcode msg to ${peer.peer.toB58String()} with request to transcode ${fileHash}`)
              this._ipfs.protocol.network.sendMessage(peer.peer, msg, (err) => {
                if (err) {
                  ev.emit('transcoding:error', err)
                  return ev
                }
              })
            }
          } catch (e) {
            console.log('PEER ERROR :', e, peer)
          }
        })

        // paratii transcoder signal.
        this._ipfs.on('protocol:incoming', this._transcoderRespHander(ev, fileHash))
      })
    })
    return ev
  }

  /**
   * handles responses from the paratii-protocol in case of transcoding.
   * @param  {EventEmitter} ev the transcoding job EventEmitter
   * @return {function}    returns various events based on transcoder response.
   * @example ?

   */
  _transcoderRespHander (ev, fileHash) {
    return (peerId, command) => {
      this._ipfs.log('paratii protocol: Received command ', command.payload.toString(), 'args: ', command.args.toString())
      let commandStr = command.payload.toString()
      let argsObj
      try {
        argsObj = JSON.parse(command.args.toString())
      } catch (e) {
        this._ipfs.error('couldn\'t parse args, ', command.args.toString())
      }

      switch (commandStr) {
        case 'transcoding:error':
          console.log('DEBUG TRANSCODER ERROR: fileHash: ', fileHash, ' , errHash: ', argsObj.hash)
          if (argsObj.hash === fileHash) {
            ev.emit('transcoding:error', argsObj.err)
          }
          break
        case 'transcoding:started':
          if (argsObj.hash === fileHash) {
            ev.emit('transcoding:started', argsObj.hash, argsObj.author)
          }
          break
        case 'transcoding:progress':
          if (argsObj.hash === fileHash) {
            ev.emit('transcoding:progress', argsObj.hash, argsObj.size, argsObj.percent)
          }
          break
        case 'uploader:progress':
          if (argsObj.hash === fileHash) {
            ev.emit('uploader:progress', argsObj.hash, argsObj.chunkSize, argsObj.percent)
          }
          break
        case 'transcoding:downsample:ready':
          if (argsObj.hash === fileHash) {
            ev.emit('transcoding:downsample:ready', argsObj.hash, argsObj.size)
          }
          break
        case 'transcoding:done':
          if (argsObj.hash === fileHash) {
            let result = JSON.parse(argsObj.result.toString())
            ev.emit('transcoding:done', argsObj.hash, result)
          }
          break
        default:
          if (argsObj.hash === fileHash) {
            this._ipfs.log('unknown command : ', commandStr)
          }
      }
    }
  }
  /**
   * convenience method for adding and transcoding files
   * @param {Array} files Array of HTML5 File Objects

   */
  addAndTranscode (files) {
    let ev = this.add(files)
    // ev.on('done', this._signalTranscoder.bind(this))
    ev.on('done', (files) => {
      this._signalTranscoder(files, ev)
    })
    return ev
  }
  /**
   * [_signalTranscoder description]
   * TODO RIVEDI I TIPI
   * @param  {Object} files [description]
   * @param  {Object} ev    [description]
   * @return {Object}       [description]

   */
  _signalTranscoder (files, ev) {
    let file
    if (Array.isArray(files)) {
      if (files.length < 1) {
        // FIXME THIS NEEDS TO BE REMOVED
        file = {hash: ''} // testing something ...
        // this._ipfs.log('_signalTranscoder Got an empty Array. files: ', files)
        // return
      } else {
        file = files[0]
      }
    } else {
      file = files
    }

    if (!ev) {
      ev = new EventEmitter()
    }

    this.transcode(file.hash, {
      author: '0x', // author address,
      ev: ev
    })
  }
  /**
   * [getMetaData description]
   * @param  {Object} fileHash [description]
   * @param  {Object} options  [description]
   * @return {Object}          [description]

   */
  getMetaData (fileHash, options) {
    return new Promise((resolve, reject) => {
      const schema = joi.object({
        transcoder: joi.string().default(this.config.ipfs.defaultTranscoder),
        transcoderId: joi.any().default(Multiaddr(this.config.ipfs.defaultTranscoder).getPeerId())
      }).unknown()

      this._ipfs.log('Signaling transcoder getMetaData...')
      const result = joi.validate(options, schema)
      const error = result.error
      if (error) reject(error)
      let opts = result.value
      console.log('opts: ', opts)
      let ev
      if (opts.ev) {
        ev = opts.ev
      } else {
        ev = new EventEmitter()
      }
      this._ipfs.start().then(() => {
        let msg = this._ipfs.protocol.createCommand('getMetaData', {hash: fileHash})
        // FIXME : This is for dev, so we just signal our transcoder node.
        // This needs to be dynamic later on.
        this._ipfs.ipfs.swarm.connect(opts.transcoder, (err, success) => {
          if (err) return reject(err)

          opts.transcoderId = opts.transcoderId || Multiaddr(opts.transcoder).getPeerId()
          this._ipfs.log('transcoderId: ', opts.transcoderId)
          this._node.swarm.peers((err, peers) => {
            this._ipfs.log('peers: ', peers)
            if (err) return reject(err)

            peers.map((peer) => {
              this._ipfs.log('peerID : ', peer.peer.id.toB58String(), opts.transcoderId, peer.peer.id.toB58String() === opts.transcoder)
              if (peer.peer.id.toB58String() === opts.transcoderId) {
                this._ipfs.log(`sending getMetaData msg to ${peer.peer.id.toB58String()} with request to transcode ${fileHash}`)
                this._ipfs.protocol.network.sendMessage(peer.peer.id, msg, (err) => {
                  if (err) {
                    ev.emit('getMetaData:error', err)
                    return ev
                  }
                })
              }
            })

            // paratii getMetaData signal.
            this._ipfs.on('protocol:incoming', (peerId, command) => {
              this._ipfs.log('paratii protocol: Received command ', command.payload.toString(), 'args: ', command.args.toString())
              let commandStr = command.payload.toString()
              let argsObj
              try {
                argsObj = JSON.parse(command.args.toString())
              } catch (e) {
                this._ipfs.error('couldn\'t parse args, ', command.args.toString())
              }

              switch (commandStr) {
                case 'getMetaData:error':
                  if (argsObj.hash === fileHash) {
                    console.log('DEBUG getMetaData ERROR: fileHash: ', fileHash, ' , errHash: ', argsObj.hash)
                    reject(argsObj.err)
                  }
                  break
                case 'getMetaData:done':
                  if (argsObj.hash === fileHash) {
                    console.log('data: ', argsObj.data)
                    let result = argsObj.data
                    resolve(result)
                  }
                  break
                default:
                  this._ipfs.log('unknown command : ', commandStr)
              }
            })
          })
        })
      })
    })
  }
  /**
   * [pinFile description]
   * @param  {Object} fileHash [description]
   * @param  {Object} options  [description]
   * @return {Object}          [description]

   */
  pinFile (fileHash, options) {
    if (options === undefined) options = {}

    const schema = joi.object({
      author: joi.string().default('0x'), // ETH/PTI address of the file owner
      transcoder: joi.string().default(this.config.ipfs.defaultTranscoder),
      transcoderId: joi.any().default(Multiaddr(this.config.ipfs.defaultTranscoder).getPeerId()),
      size: joi.number().default(0)
    }).unknown()

    this._ipfs.log(`Signaling transcoder to pin ${fileHash}`)

    const result = joi.validate(options, schema)
    const error = result.error
    if (error) throw error
    let opts = result.value

    let ev
    if (opts.ev) {
      ev = opts.ev
    } else {
      ev = new EventEmitter()
    }

    let msg = this._ipfs.protocol.createCommand('pin', {hash: fileHash, author: opts.author, size: opts.size})
    // FIXME : This is for dev, so we just signal our transcoder node.
    // This needs to be dynamic later on.
    this._node.swarm.connect(opts.transcoder, (err, success) => {
      if (err) return ev.emit('pin:error', err)

      this._node.swarm.peers((err, peers) => {
        this._ipfs.log('peers: ', peers)
        if (err) return ev.emit('pin:error', err)
        peers.map((peer) => {
          try {
            this._ipfs.log('peer.peer.toB58String(): ', peer.peer.toB58String())
            if (peer.peer.toB58String() === opts.transcoderId) {
              this._ipfs.log(`sending pin msg to ${peer.peer._idB58String} with request to pin ${fileHash}`)
              this._ipfs.protocol.network.sendMessage(peer.peer, msg, (err) => {
                if (err) {
                  ev.emit('pin:error', err)
                  return ev
                }
              })
            }
          } catch (e) {
            console.log('PEER ERROR :', e, peer)
          }
        })

        // paratii pinning response.
        this._ipfs.on('protocol:incoming', this._pinResponseHandler(ev))
      })
    })

    return ev
  }
  /**
   * [_pinResponseHandler description]
   * @param  {Object} ev [description]
   * @return {Object}    [description]

   */
  _pinResponseHandler (ev) {
    return (peerId, command) => {
      this._ipfs.log('paratii protocol: Received command ', command.payload.toString(), 'args: ', command.args.toString())
      let commandStr = command.payload.toString()
      let argsObj
      try {
        argsObj = JSON.parse(command.args.toString())
      } catch (e) {
        this._ipfs.log('couldn\'t parse args, ', command.args.toString())
      }

      switch (commandStr) {
        case 'pin:error':
          ev.emit('pin:error', argsObj.err)
          break
        case 'pin:progress':
          ev.emit('pin:progress', argsObj.hash, argsObj.chunkSize, argsObj.percent)
          break
        case 'pin:done':
          ev.emit('pin:done', argsObj.hash)
          break
        default:
          this._ipfs.log('unknown command : ', commandStr)
      }
    }
  }

  // grabYt (url, onResponse, callback) {
  //   let starttime
  //   let fileSize
  //   let video = ytdl(url)
  //   video.once('response', () => {
  //     this._ipfs.log(`starting ${url}`)
  //     starttime = Date.now()
  //     onResponse(null, starttime)
  //   })
  //
  //   video.on('error', (err) => {
  //     onResponse(err)
  //   })
  //
  //   video.on('progress', (chunkLength, downloaded, total) => {
  //     fileSize = total
  //     // const floatDownloaded = downloaded / total
  //     // const downloadedMinutes = (Date.now() - starttime) / 1000 / 60
  //     // readline.cursorTo(process.stdout, 0)
  //     // process.stdout.write(`${(floatDownloaded * 100).toFixed(2)}% downloaded`)
  //     // process.stdout.write(`(${(downloaded / 1024 / 1024).toFixed(2)}MB of ${(total / 1024 / 1024).toFixed(2)}MB)\n`)
  //     // process.stdout.write(`running for: ${downloadedMinutes.toFixed(2)}minutes`)
  //     // process.stdout.write(`, estimated time left: ${(downloadedMinutes / floatDownloaded - downloadedMinutes).toFixed(2)}minutes `)
  //     // readline.moveCursor(process.stdout, 0, -1)
  //   })
  //
  //   video.on('end', () => {
  //     process.stdout.write('\n\n')
  //     // cb(null, output)
  //   })
  //
  //   var total = 0
  //   function updateProgress (chunkLength) {
  //     total += chunkLength
  //     this._ipfs.log('Progress \t', total, ' / ', fileSize, ' = ', Math.floor((total / fileSize) * 100))
  //   }
  //
  //   pull(
  //     pull.values([{
  //       path: url,
  //       content: pull(
  //         toPull(video),
  //         pull.through((chunk) => updateProgress(chunk.length))
  //       )
  //     }]),
  //     this._node.files.addPullStream({chunkerOptions: {maxChunkSize: this._chunkSize}}), // default size 262144
  //     this._signalTranscoderPull(callback)
  //   )
  // }
  //
  // grabVimeo (url, onResponse, callback) {
  //   let starttime
  //   // let total = 0
  //   let video = vidl(url, {quality: '720p'})
  //
  //   video.once('response', () => {
  //     this._ipfs.log(`starting ${url}`)
  //     starttime = Date.now()
  //     onResponse(null, starttime)
  //   })
  //
  //   video.on('data', (chunk) => {
  //     // total += chunk.length / 1024 / 1024
  //   })
  //
  //   video.on('end', () => {
  //     // process.stdout.write('\n\n')
  //     // cb(null, output)
  //   })
  //
  //   function updateProgress (chunkLength) {
  //     // this._ipfs.log('Progress \t', total, ' / ', fileSize, ' = ', Math.floor((total / fileSize) * 100))
  //   }
  //
  //   pull(
  //     pull.values([{
  //       path: url,
  //       content: pull(
  //         toPull(video),
  //         pull.through((chunk) => updateProgress(chunk.length))
  //       )
  //     }]),
  //     this._node.files.addPullStream({chunkerOptions: {maxChunkSize: this._chunkSize}}), // default size 262144
  //     this._signalTranscoderPull(callback)
  //   )
  // }
  //
}