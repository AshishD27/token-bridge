const sinon = require('sinon')
const { expect } = require('chai')
const proxyquire = require('proxyquire').noPreserveCache()
const Web3Utils = require('web3-utils')
const { fetchGasPrice, processGasPriceOptions } = require('../src/services/gasPrice')
const {
  DEFAULT_UPDATE_INTERVAL,
  GAS_PRICE_OPTIONS,
  ORACLE_GAS_PRICE_SPEEDS
} = require('../src/utils/constants')

describe('gasPrice', () => {
  describe('fetchGasPrice', () => {
    const oracleMockResponse = {
      fast: 17.64,
      block_time: 13.548,
      health: true,
      standard: 10.64,
      block_number: 6704240,
      instant: 51.9,
      slow: 4.4
    }
    beforeEach(() => {
      sinon.stub(console, 'error')
    })
    afterEach(() => {
      console.error.restore()
    })

    it('should fetch the gas price from the oracle by default', async () => {
      // given
      const oracleFnMock = () =>
        Promise.resolve({
          oracleGasPrice: '1',
          oracleResponse: oracleMockResponse
        })
      const bridgeContractMock = {
        methods: {
          gasPrice: {
            call: sinon.stub().returns(Promise.resolve('2'))
          }
        }
      }

      // when
      const { gasPrice, oracleGasPriceSpeeds } = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock
      })

      // then
      expect(gasPrice).to.equal('1')
      expect(oracleGasPriceSpeeds).to.equal(oracleMockResponse)
    })
    it('should fetch the gas price from the contract if the oracle fails', async () => {
      // given
      const oracleFnMock = () => Promise.reject(new Error('oracle failed'))
      const bridgeContractMock = {
        methods: {
          gasPrice: sinon.stub().returns({
            call: sinon.stub().returns(Promise.resolve('2'))
          })
        }
      }

      // when
      const { gasPrice, oracleGasPriceSpeeds } = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock
      })

      // then
      expect(gasPrice).to.equal('2')
      expect(oracleGasPriceSpeeds).to.equal(null)
    })
    it('should return null if both the oracle and the contract fail', async () => {
      // given
      const oracleFnMock = () => Promise.reject(new Error('oracle failed'))
      const bridgeContractMock = {
        methods: {
          gasPrice: sinon.stub().returns({
            call: sinon.stub().returns(Promise.reject(new Error('contract failed')))
          })
        }
      }

      // when
      const { gasPrice, oracleGasPriceSpeeds } = await fetchGasPrice({
        bridgeContract: bridgeContractMock,
        oracleFn: oracleFnMock
      })

      // then
      expect(gasPrice).to.equal(null)
      expect(oracleGasPriceSpeeds).to.equal(null)
    })
  })
  describe('start', () => {
    const utils = { setIntervalAndRun: sinon.spy() }
    beforeEach(() => {
      utils.setIntervalAndRun.resetHistory()
    })
    it('should call setIntervalAndRun with HOME_GAS_PRICE_UPDATE_INTERVAL interval value on Home', async () => {
      // given
      process.env.HOME_GAS_PRICE_UPDATE_INTERVAL = 15000
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('home')

      // then
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.equal('15000')
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(
        DEFAULT_UPDATE_INTERVAL.toString()
      )
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(
        process.env.HOME_GAS_PRICE_UPDATE_INTERVAL.toString()
      )
    })
    it('should call setIntervalAndRun with FOREIGN_GAS_PRICE_UPDATE_INTERVAL interval value on Foreign', async () => {
      // given
      process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL = 15000
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('foreign')

      // then
      expect(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL).to.equal('15000')
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.not.equal(
        DEFAULT_UPDATE_INTERVAL.toString()
      )
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(
        process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL.toString()
      )
    })
    it('should call setIntervalAndRun with default interval value on Home', async () => {
      // given
      delete process.env.HOME_GAS_PRICE_UPDATE_INTERVAL
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('home')

      // then
      expect(process.env.HOME_GAS_PRICE_UPDATE_INTERVAL).to.equal(undefined)
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(DEFAULT_UPDATE_INTERVAL)
    })
    it('should call setIntervalAndRun with default interval value on Foreign', async () => {
      // given
      delete process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL
      const gasPrice = proxyquire('../src/services/gasPrice', { '../utils/utils': utils })

      // when
      await gasPrice.start('foreign')

      // then
      expect(process.env.FOREIGN_GAS_PRICE_UPDATE_INTERVAL).to.equal(undefined)
      expect(utils.setIntervalAndRun.args[0][1]).to.equal(DEFAULT_UPDATE_INTERVAL)
    })
  })
  describe('processGasPriceOptions', () => {
    const oracleMockResponse = {
      fast: 17.64,
      block_time: 13.548,
      health: true,
      standard: 10.64,
      block_number: 6704240,
      instant: 51.9,
      slow: 4.4
    }
    it('should return cached gas price if no options provided', async () => {
      // given
      const options = {}
      const cachedGasPrice = '1000000000'

      // when
      const gasPrice = await processGasPriceOptions({
        options,
        cachedGasPrice,
        cachedGasPriceOracleSpeeds: oracleMockResponse
      })

      // then
      expect(gasPrice).to.equal(cachedGasPrice)
    })
    it('should return gas price provided by options', async () => {
      // given
      const options = {
        type: GAS_PRICE_OPTIONS.GAS_PRICE,
        value: '3000000000'
      }
      const cachedGasPrice = '1000000000'

      // when
      const gasPrice = await processGasPriceOptions({
        options,
        cachedGasPrice,
        cachedGasPriceOracleSpeeds: oracleMockResponse
      })

      // then
      expect(gasPrice).to.equal(options.value)
    })
    it('should return gas price provided by oracle speed option', async () => {
      // given
      const options = {
        type: GAS_PRICE_OPTIONS.SPEED,
        value: ORACLE_GAS_PRICE_SPEEDS.STANDARD
      }
      const cachedGasPrice = '1000000000'
      const oracleGasPriceGwei = oracleMockResponse[ORACLE_GAS_PRICE_SPEEDS.STANDARD]
      const oracleGasPrice = Web3Utils.toWei(oracleGasPriceGwei.toString(), 'gwei')

      // when
      const gasPrice = await processGasPriceOptions({
        options,
        cachedGasPrice,
        cachedGasPriceOracleSpeeds: oracleMockResponse
      })

      // then
      expect(gasPrice).to.equal(oracleGasPrice)
    })
    it('should return cached gas price if invalid speed option', async () => {
      // given
      const options = {
        type: GAS_PRICE_OPTIONS.SPEED,
        value: 'unknown'
      }
      const cachedGasPrice = '1000000000'

      // when
      const gasPrice = await processGasPriceOptions({
        options,
        cachedGasPrice,
        cachedGasPriceOracleSpeeds: oracleMockResponse
      })

      // then
      expect(gasPrice).to.equal(cachedGasPrice)
    })
  })
})
