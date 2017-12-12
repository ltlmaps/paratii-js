import { getInfoFromLogs } from './utils.js'
let dopts = require('default-options')

export class ParatiiEthVids {
  constructor (context) {
    // context is a ParatiiEth instance
    this.eth = context
  }

  async getRegistry () {
    return this.eth.getContract('VideoRegistry')
  }

  async create (options) {
    let defaults = {
      id: String,
      owner: String,
      price: Number,
      ipfsHash: String
    }

    if (!this.eth.web3.utils.isAddress(options.owner)) {
      let msg = `The owner argument should be a valid address, not ${options.owner}`
      throw Error(msg)
    }
    options = dopts(options, defaults)
    let contract = await this.getRegistry()
    let tx = await contract.methods.registerVideo(options.id, options.owner, options.price, options.ipfsHash).send()
    let videoId = getInfoFromLogs(tx, 'LogRegisterVideo', 'videoId')
    return videoId
  }

  async get (videoId) {
    let contract = await this.getRegistry()
    let videoInfo = await contract.methods.getVideoInfo(videoId).call()
    let result = {
      id: videoId,
      owner: videoInfo[0],
      price: videoInfo[1],
      ipfsHash: videoInfo[2]
    }
    return result
  }

  async update (videoId, options) {
    options.id = videoId
    let data = await this.get(videoId)
    for (let key in options) {
      data[key] = options[key]
    }
    await this.create(data)
    return data
  }

  async delete (videoId) {
    let contract = await this.getRegistry()
    let tx = contract.methods.unregisterVideo(videoId).send()
    return tx
  }
}