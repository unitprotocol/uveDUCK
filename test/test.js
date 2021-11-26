const chai = require("chai")
const { solidity } = require("ethereum-waffle")
chai.use(solidity)
const { ethers } = require('hardhat')

const DAY = 86400
const WEEK = 7 * DAY

const crvWhale = '0x7a16fF8270133F063aAb6C9977183D9e72835428'
const usdpLPWhale = '0x1b5eb1173d2bf770e50f10410c9a96f7a8eb6e75'
const usdpAddress = '0x1456688345527be1f37e9e627da0837d6f08c925'
const wcd = '0x40907540d8a6c65c637785e8f8b742ae6b0b9968'
const sww = '0xca719728Ef172d0961768581fdF35CB116e0B7a4'
const usdpLPAddress = '0x7eb40e450b9655f4b3cc4259bcc731c63ff55ae6'
const usdpGauge = '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222'
const extraRewardStashV3 = '0xd7AbC64CAFc30FDd08A42Ea4bC13846be455399C'
const unitVault = '0xb1cFF81b9305166ff1EFc49A129ad2AfCd7BCf19'

let crv, admin, alice, bob, charlie, m, walletCheckerDao,
    smartWalletWhiteList, u, usdpLP, threecrv, dai, usdp

let voteProxy, booster, uveCrv, rewardFactory,
    stashFactory, extraRewardStashV2, tokenFactory,
    crvDepositor, lockFees, unitMultisig

let oracleRegistry, cdpManager, wrappedToUnderlyingOracle, unitParameters

const crvDepositAmount = 10n ** 6n * 10n ** 18n

describe("Functional test", function() {

  before(async function () {
    crv = await ethers.getContractAt("IERC20", "0xD533a949740bb3306d119CC777fa900bA034cd52")
    dai = await ethers.getContractAt("IERC20", "0x6B175474E89094C44Da98b954EedeAC495271d0F")
    threecrv = await ethers.getContractAt("IERC20", "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490")
    usdpLP = await ethers.getContractAt("IERC20", usdpLPAddress)
    usdp = await ethers.getContractAt("IERC20", usdpAddress)
    smartWalletWhiteList = await ethers.getContractAt("ISmartWalletWhitelist", sww)
    ;[admin, alice, bob, charlie] = await ethers.getSigners()

    oracleRegistry = await ethers.getContractAt("IOracleRegistry", '0x75fBFe26B21fd3EA008af0C764949f8214150C8f')
    cdpManager = await ethers.getContractAt("ICDPManager01", '0xee84F58Ee39C6122C76C1Fa54f0B6f33da1642Ec')
    wrappedToUnderlyingOracle = await ethers.getContractAt("IWrappedToUnderlyingOracle", '0x220Ea780a484c18fd0Ab252014c58299759a1Fbd')
    unitParameters = await ethers.getContractAt("IParametersBatchUpdater", '0x4DD1A6DB148BEcDADAdFC407D23b725eDd3cfB6f')

    await ethers.provider.send("hardhat_impersonateAccount", [crvWhale]);
    await ethers.provider.send("hardhat_impersonateAccount", [usdpLPWhale]);
    m = await ethers.getSigner(crvWhale)
    u = await ethers.getSigner(usdpLPWhale)
    await ethers.provider.send("hardhat_setBalance", [usdpLPWhale, '0x3635c9adc5dea00000' /* 1000Ether */]);

    await ethers.provider.send("hardhat_impersonateAccount", ['0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8']);
    unitMultisig = await ethers.getSigner("0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8")
    await ethers.provider.send("hardhat_setBalance", ["0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8", '0x3635c9adc5dea00000' /* 1000Ether */]);

    await ethers.provider.send("hardhat_impersonateAccount", [wcd]);
    walletCheckerDao = await ethers.getSigner(wcd)

    voteProxy = await (await ethers.getContractFactory("CurveVoterProxy")).deploy()
    booster = await (await ethers.getContractFactory("Booster")).deploy(voteProxy.address)
    uveCrv = await (await ethers.getContractFactory("UVECRV")).deploy()
    rewardFactory = await (await ethers.getContractFactory("RewardFactory")).deploy(booster.address, uveCrv.address)
    stashFactory = await (await ethers.getContractFactory("StashFactoryV2")).deploy(booster.address, rewardFactory.address)
    extraRewardStashV2 = await (await ethers.getContractFactory("ExtraRewardStashV2")).deploy()
    tokenFactory = await (await ethers.getContractFactory("TokenFactory")).deploy(booster.address)
    crvDepositor = await (await ethers.getContractFactory("CrvDepositor")).deploy(voteProxy.address, uveCrv.address)

    // initial settings
    await stashFactory.setImplementation(ethers.constants.AddressZero, extraRewardStashV2.address, extraRewardStashV3)
    await uveCrv.setOperator(crvDepositor.address)
    await booster.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address)
    await booster.setFeeInfo()
    lockFees = await ethers.getContractAt("FeePool", await booster.lockFees())

  })

  it("CRV -> UVECRV", async function() {

    await crv.connect(m).transfer(voteProxy.address, 1)

    await voteProxy.setOperator(booster.address)
    await voteProxy.setDepositor(crvDepositor.address)

    await smartWalletWhiteList.connect(walletCheckerDao).approveWallet(voteProxy.address)

    await crvDepositor.initialLock()
    await crv.connect(m).approve(crvDepositor.address, crvDepositAmount)
    await crvDepositor.connect(m)['deposit(uint256,address)'](crvDepositAmount, lockFees.address)
  })

  it("voting", async function() {
    const gaugeController = await ethers.getContractAt('IGaugeController', '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB')
    console.log('weight before', BigInt(await gaugeController.get_gauge_weight(usdpGauge)))
    await booster.voteGaugeWeight([usdpGauge], [10000])
    console.log('weight after', BigInt(await gaugeController.get_gauge_weight(usdpGauge)))
  })

  it("3crv claim for UVECRV provided as collateral on Unit", async function() {

    // add SUVECRV as collateral on Unit Protocol (unit side)
    await oracleRegistry.connect(unitMultisig).setOracleTypeForAsset(lockFees.address, 11)
    await wrappedToUnderlyingOracle.connect(unitMultisig).setUnderlying(lockFees.address, crv.address)
    await unitParameters.connect(unitMultisig).setCollaterals([lockFees.address], 0, 0, 50, 75, 0, 1100, 10n ** 23n, [11])

    // provide collateral and mint some USDP
    await lockFees.connect(m).approve(unitVault, crvDepositAmount)
    await usdp.connect(m).approve(cdpManager.address, 10n ** 20n)
    await cdpManager.connect(m).join(lockFees.address, crvDepositAmount, 10n ** 21n)

    // await booster.setRewardContract(ethers.constants.AddressZero /*veDistribution*/);

    const burner = await ethers.getContractAt("IBurner", '0xeCb456EA5365865EbAb8a2661B0c503410e9B347')
    const underlyingBurner = await ethers.getContractAt("IBurner", '0x786B374B5eef874279f4B7b4de16940e57301A58')

    // 3crv claim

    await booster.earmarkFees();
    console.log("fees earmarked")

    await threecrv.balanceOf(lockFees.address).then( a => console.log("lockFees balance: ", BigInt(a)))

    await ethers.provider.send('evm_mine', [await chainTime() + WEEK + WEEK + DAY])
    console.log("advance time...")


    /// ----- burn fees to vecrv claim contracts (curve dao side) ----
    const burnerBalance = BigInt(await threecrv.balanceOf("0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc"));
    console.log("3crv on burner: ", burnerBalance)

    const daiBalance = BigInt(await dai.balanceOf(burner.address))
    console.log("burner dai:", daiBalance)

    await burner.withdraw_admin_fees("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7")
    console.log("admin fees withdrawn from pool")

    const daiBalance2 = BigInt(await dai.balanceOf(burner.address))
    console.log("burner dai:", daiBalance2)

    const underlyingDaiBalance = BigInt(await dai.balanceOf(underlyingBurner.address))
    console.log("underlyingBurner dai:", underlyingDaiBalance)

    await burner.burn(dai.address)
    await burner.burn("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
    await burner.burn("0xdAC17F958D2ee523a2206206994597C13D831ec7")
    console.log("burnt single coins")

    await dai.balanceOf(burner.address).then(a => console.log("burner dai: ", BigInt(a)))
    await dai.balanceOf(underlyingBurner.address).then(a => console.log("dai on underlyingburner: ", BigInt(a)))

    //execute to wrap everything to 3crv then send to "receiver" at 0xa464
    await underlyingBurner.execute()
    console.log("burner executed")

    //should be zero now that its transfered
    await dai.balanceOf(burner.address).then(a => console.log("burner dai: ", BigInt(a)))
    await dai.balanceOf(underlyingBurner.address).then( a => console.log("dai on underlyingburner: ", BigInt(a)))

    //burn 3crv
    await burner.burn(threecrv.address)
    console.log("burn complete, checkpoint 3crv")

    const burnerBalance2 = await threecrv.balanceOf("0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc")
    console.log("3crv on burner:", BigInt(burnerBalance2))

    console.log('currentRewards', BigInt(await lockFees.currentRewards()))
    await booster.earmarkFees()
    console.log('currentRewards', BigInt(await lockFees.currentRewards()))

    await threecrv.balanceOf(lockFees.address).then( a => console.log("lockFees balance: ", BigInt(a)))

    await lockFees.earned(crvWhale).then(a => console.log("earned fees: ", BigInt(a)))

    console.log("advance time...");
    await ethers.provider.send('evm_mine', [await chainTime() + DAY])
    await lockFees.earned(crvWhale).then(a => console.log("earned fees: ", BigInt(a)))

    console.log("advance time...");
    await ethers.provider.send('evm_mine', [await chainTime() + DAY])
    await lockFees.earned(crvWhale).then(a => console.log("earned fees: ", BigInt(a)))

    const balanceBefore = BigInt(await threecrv.balanceOf(crvWhale))
    await lockFees.connect(m)['getReward()']()
    const balanceAfter = BigInt(await threecrv.balanceOf(crvWhale))
    console.log('reward claimed', balanceAfter - balanceBefore, '3CRV')
  })

  it("lp staking", async function() {
    const depositAmount = 10n ** 21n

    // stake usdpCRV
    await booster.addPool(usdpLP.address, usdpGauge, 2)
    await usdpLP.connect(u).approve(booster.address, depositAmount)
    await booster.connect(u).deposit(0, depositAmount, true)
    console.log('usdpCRV deposited & staked')
  })

  it("CRV claim for lp staking", async function() {
    const poolId = 0
    const poolinfo = await booster.poolInfo(poolId)
    const rewardPoolAddress = poolinfo.crvRewards
    const rewardPool = await ethers.getContractAt("BaseRewardPool", rewardPoolAddress)
    const depositToken = await ethers.getContractAt("DepositToken", poolinfo.token)

    console.log("pool lp token " +poolinfo.lptoken)
    console.log("pool gauge " +poolinfo.gauge)
    console.log("pool reward contract at " +rewardPool.address)

    await depositToken.name().then(a=>console.log("deposit token name: " +a))
    await depositToken.symbol().then(a=>console.log("deposit token symbol: " +a))

    await ethers.provider.send('evm_mine', [await chainTime() + DAY])

    //collect and distribute rewards off gauge
    await booster.earmarkRewards(poolId)
    console.log("----earmark 1----")

    await rewardPool.earned(usdpLPWhale).then(a => console.log("claimable", BigInt(a), 'CRV'))

    console.log("advance time...")
    await ethers.provider.send('evm_mine', [await chainTime() + 6 * DAY])

    await booster.earmarkRewards(poolId)
    console.log("----earmark 2----")

    await rewardPool.earned(usdpLPWhale).then(a => console.log("claimable", BigInt(a), 'CRV'))

    await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool", BigInt(a)))

    console.log("advance time...")
    await ethers.provider.send('evm_mine', [await chainTime() + 7 * DAY])
    await rewardPool.earned(usdpLPWhale).then(a => console.log("claimable", BigInt(a), 'CRV'))
    await rewardPool.connect(u)['getReward()']()
    await crv.balanceOf(usdpLPWhale).then(a=>console.log("claimed", BigInt(a), 'CRV'))
  })
})

const chainTime = async () => (await ethers.provider.getBlock('latest')).timestamp