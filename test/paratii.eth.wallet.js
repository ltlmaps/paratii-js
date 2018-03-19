import { Paratii } from '../lib/paratii.js'
import { address, address1, privateKey, address17, mnemonic23, address23 } from './utils.js'
import { add0x } from '../lib/utils.js'
import { assert } from 'chai'

describe('paratii.eth.wallet: :', function () {
  let paratii
  let mnemonic = mnemonic23
  let addresses = [
    address23
  ]
  let password = 'some-password'

  it('init account is added to wallet', async function () {
    paratii = new Paratii({
      provider: 'http://localhost:8545',
      address: address,
      privateKey: privateKey
    })
    assert.equal(paratii.eth.wallet.length, 1)
  })
  it('if no account is given, the wallet accounts are empty', async function () {
    paratii = await new Paratii()
    assert.equal(paratii.eth.wallet.length, 0)
  })

  it('wallet.create() works', async function () {
    paratii = await new Paratii()

    let wallet = paratii.eth.wallet
    assert.equal(wallet.length, 0)

    wallet = await wallet.create(5, mnemonic)
    assert.equal(wallet.length, 5)

    assert.isTrue(paratii.eth.web3.utils.isAddress(wallet[1].address))
    assert.isTrue(paratii.eth.web3.utils.isAddress(wallet[2].address))
    assert.equal(wallet[0].address, addresses[0])
  })

  it('wallet.create() does not create a new wallet object', async function () {
    paratii = await new Paratii()
    let wallet = await paratii.eth.wallet.create(5, mnemonic)
    assert.equal(wallet, paratii.eth.wallet)
  })

  it('wallet.create() creates a new mnemonic if no mnemonic is given', async function () {
    paratii = await new Paratii()
    let wallet = paratii.eth.wallet
    await wallet.create()
    // if it creates an address, it means that it has generated a new mnmemonic
    assert.equal(wallet.length, 1)
})

  it('wallet.create() sets config.account.address and privatekey', async function () {
    paratii = await new Paratii()
    let wallet = paratii.eth.wallet
    await wallet.create()
    assert.equal(wallet[0].address, paratii.config.account.address)
    assert.isOk(paratii.config.account.privateKey)
  })

  it('wallet.create(), wallet.encrypt() and wallet.decrypt() play nicely together', async function () {
    paratii = await new Paratii()
    let w1 = await paratii.eth.wallet.create(1)
    let w1encrypted = w1.encrypt('')
    assert.equal(w1[0].address.toLowerCase(), '0x' + w1encrypted[0].address)
    let w1decrypted = paratii.eth.wallet.decrypt(w1encrypted, '')
    assert.equal(w1[0].address, w1decrypted[0].address)
  })

  it('wallet.decrypt() sets config.account.address and privatekey', async function () {
    let data = [
      {
        'version': 3,
        'id': '34765d92-5855-416e-bf47-2b63433bb1b4',
        'address': '0xCbe4f07b343171ac37055B25a5266f48f6945b7d',
        'crypto': {
          'ciphertext': 'f8f83eb1afb7d5d149cd8a721f5cbfb788adf1d426ac74921f4e5948eff01c9a',
          'cipherparams': {'iv': '08557eddac9a617c2022df8480807026'},
          'cipher': 'aes-128-ctr',
          'kdf': 'scrypt',
          'kdfparams': {
            'dklen': 32, 'salt': 'b741c07d066a7a15cb2d68a223b291d83d3366e4320ec015eb4fab80b9b94fbb', 'n': 8192, 'r': 8, 'p': 1
          },
          'mac': '3d68528168be9aebc3e7f38576af628ad98da60a2b2256d87bef3d9fa5e4640f'}}
    ]
    paratii = await new Paratii()
    let decryptedWallet = await paratii.eth.wallet.decrypt(data, '')
    assert.equal(decryptedWallet[0].address, paratii.config.account.address)
    assert.isOk(paratii.config.account.privateKey)
  })

  it('wallet.encrypt() and decrypt() works', async function () {
    paratii = await new Paratii()
    let wallet = paratii.eth.wallet

    wallet = await wallet.create(5, mnemonic)
    assert.equal(wallet[0].address, addresses[0])

    let data = wallet.encrypt(password)
    assert.equal(add0x(data[0].address), addresses[0].toLowerCase())

    wallet = wallet.decrypt(data, password)
    assert.equal(wallet[0].address, addresses[0])
  })

  it.skip('send() should fail if no wallet is present', async function () {
    paratii = new Paratii({
      address: address,
      privateKey: privateKey
    })
    await paratii.eth.deployContracts()

    // instantiate paratii with an unlocked account
    paratii = new Paratii({
      provider: 'http://localhost:8545',
      address: address17,
      registryAddress: paratii.config.registryAddress
    })
    // set the account but not the private key
    // paratii.setAccount(address17)
    await assert.isRejected(paratii.eth.transfer(address1, 2e18, 'ETH'), 'could not unlock signer account')
  })

  it('send() should succeed if a  private key is passed to the constructor', async function () {
    paratii = new Paratii({
      provider: 'http://localhost:8545',
      address: address,
      privateKey: privateKey
    })
    await paratii.eth.deployContracts()
    await paratii.eth.transfer(address1, 2e10, 'ETH', 'thanks for all the fish')
  })

  it('eth.wallet.isValidMnemonic() should work as expected', async function () {
    paratii = await new Paratii()
    assert.isOk(paratii.eth.wallet.isValidMnemonic(mnemonic23))
    assert.isNotOk(paratii.eth.wallet.isValidMnemonic('some dumb string'))
  })

  it('eth.wallet.newMnemonic() should work as expected', async function () {
    paratii = await new Paratii()
    let m1 = paratii.eth.wallet.newMnemonic()
    let m2 = paratii.eth.wallet.newMnemonic()
    assert.notEqual(m1, m2)
    assert.isOk(paratii.eth.wallet.isValidMnemonic(m1))
  })
  it('eth.wallet.create() should throw if a wallet already has an account', async function () {
    paratii = new Paratii({
      address: address,
      privateKey: privateKey
    })
    await assert.isRejected(paratii.eth.wallet.create())
  })

  it.skip('eth.wallet.getMnemonic() should work as expected', async function () {
    paratii = await new Paratii()
    assert.equal(paratii.eth.wallet.getMnemonic(), undefined)
    let wallet = await paratii.eth.wallet.create()
    assert.notEqual(wallet.getMnemonic(), undefined)
    assert.isOk(wallet.isValidMnemonic(wallet.getMnemonic()))

    // if we construct the paratii object with
    paratii = new Paratii({
      address: address,
      privateKey: privateKey
    })
    assert.equal(paratii.eth.wallet.getMnemonic(), undefined)
  })
  it.skip('eth.wallet.create() respect bip39 test vector', async function () {
    var vector = require('./testData/bip39-test-vector.json')

    for (var i = 0; i < vector.english.length; i++) {
      paratii = await new Paratii()
      let wallet = paratii.eth.wallet

      var p = wallet.setPassphrase('TREZOR')
      assert.equal(p, 'TREZOR')

      wallet = await wallet.create(1, vector.english[i][1])

      assert.equal(wallet._mnemonic, vector.english[i][1])
      assert.equal(wallet._seedHex, vector.english[i][2])
      assert.equal(wallet._xpriv, vector.english[i][3])
    }
  })
})
