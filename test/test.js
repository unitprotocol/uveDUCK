const chai = require("chai")
const { solidity } = require("ethereum-waffle")
chai.use(solidity)
const { ethers } = require('hardhat')
const {deploy} = require("../scripts/deployFns");
const {expect} = require("chai");

const DAY = 86400
const WEEK = 7 * DAY

const USDP_POOL_ID = 0;
const CVXCRV_POOL_ID = 1;

const crvWhaleAddress = '0x7a16fF8270133F063aAb6C9977183D9e72835428'
const usdpLPWhaleAddress = '0x1b5eb1173d2bf770e50f10410c9a96f7a8eb6e75'
const usdpAddress = '0x1456688345527be1f37e9e627da0837d6f08c925'
const wcd = '0x40907540d8a6c65c637785e8f8b742ae6b0b9968'
const sww = '0xca719728Ef172d0961768581fdF35CB116e0B7a4'
const usdpLPAddress = '0x7eb40e450b9655f4b3cc4259bcc731c63ff55ae6'
const usdpGauge = '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222'
const extraRewardStashV3 = '0xd7AbC64CAFc30FDd08A42Ea4bC13846be455399C'
const unitVault = '0xb1cFF81b9305166ff1EFc49A129ad2AfCd7BCf19'

// v3 gauge
const cvxcrvGaugeAddress = '0x903da6213a5a12b61c821598154efad98c3b20e4';
const cvxcrvLPAddress = '0x9d0464996170c6b9e75eed71c68b99ddedf279e8';
const cvxcrvLPWhaleAddress = '0x903da6213a5a12b61c821598154efad98c3b20e4';
const cvxAddress = '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b';
const cvxWhaleAddress = '0x5f465e9fcffc217c5849906216581a657cd60605';
const cvxcrvGaugeAdminAddress = '0x2ef1bc1961d3209e5743c91cd3fbfa0d08656bc3'

let crv, admin, alice, bob, charlie, crvWhale, walletCheckerDao,
    smartWalletWhiteList, usdpLPWhale, usdpLP, threecrv, dai, usdp,
    cvxcrvLP, cvxcrvLPWhale, cvx, cvxWhale, cvxcrvGaugeAdmin, cvxcrvGauge

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

    await ethers.provider.send("hardhat_impersonateAccount", [crvWhaleAddress]);
    await ethers.provider.send("hardhat_impersonateAccount", [usdpLPWhaleAddress]);
    crvWhale = await ethers.getSigner(crvWhaleAddress)
    usdpLPWhale = await ethers.getSigner(usdpLPWhaleAddress)
    await ethers.provider.send("hardhat_setBalance", [usdpLPWhaleAddress, '0x3635c9adc5dea00000' /* 1000Ether */]);

    await ethers.provider.send("hardhat_impersonateAccount", ['0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8']);
    unitMultisig = await ethers.getSigner("0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8")
    await ethers.provider.send("hardhat_setBalance", ["0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8", '0x3635c9adc5dea00000' /* 1000Ether */]);

    await ethers.provider.send("hardhat_impersonateAccount", [wcd]);
    walletCheckerDao = await ethers.getSigner(wcd);

    (
      {
        voteProxy,
        booster,
        uveCrv,
        rewardFactory,
        stashFactory,
        extraRewardStashV2,
        tokenFactory,
        crvDepositor
      } = await deploy()
    );

    lockFees = await ethers.getContractAt("FeePool", await booster.lockFees())

    // cvxCRV for gaugev3
    cvxcrvLP = await ethers.getContractAt("IERC20", cvxcrvLPAddress)
    await ethers.provider.send("hardhat_impersonateAccount", [cvxcrvLPWhaleAddress]);
    cvxcrvLPWhale = await ethers.getSigner(cvxcrvLPWhaleAddress)
    await ethers.provider.send("hardhat_setBalance", [cvxcrvLPWhaleAddress, '0x3635c9adc5dea00000' /* 1000Ether */]);

    cvx = await ethers.getContractAt("IERC20", cvxAddress)
    await ethers.provider.send("hardhat_impersonateAccount", [cvxWhaleAddress]);
    cvxWhale = await ethers.getSigner(cvxWhaleAddress)
    await ethers.provider.send("hardhat_setBalance", [cvxWhaleAddress, '0x3635c9adc5dea00000' /* 1000Ether */]);

    await ethers.provider.send("hardhat_impersonateAccount", [cvxcrvGaugeAdminAddress]);
    cvxcrvGaugeAdmin = await ethers.getSigner(cvxcrvGaugeAdminAddress)
    await ethers.provider.send("hardhat_setBalance", [cvxcrvGaugeAdminAddress, '0x3635c9adc5dea00000' /* 1000Ether */]);

    cvxcrvGauge = await ethers.getContractAt("ICurveGauge", cvxcrvGaugeAddress)

    await booster.addPool(cvxcrvLPAddress, cvxcrvGaugeAddress, 3) // pool for cvxCRV
  })

  it("CRV -> UVECRV", async function() {

    await crv.connect(crvWhale).transfer(voteProxy.address, 1) // transfers on voteproxy some crv for initial lock

    await smartWalletWhiteList.connect(walletCheckerDao).approveWallet(voteProxy.address)

    await crvDepositor.initialLock()
    await crv.connect(crvWhale).approve(crvDepositor.address, crvDepositAmount)

    const depositResult1 = await crvDepositor.connect(crvWhale)['deposit(uint256,address)'](crvDepositAmount, lockFees.address)
    console.log('Deposit gas used', (await depositResult1.wait()).gasUsed.toString())
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
    await lockFees.connect(crvWhale).approve(unitVault, crvDepositAmount)
    await usdp.connect(crvWhale).approve(cdpManager.address, 10n ** 20n)
    await cdpManager.connect(crvWhale).join(lockFees.address, crvDepositAmount, 10n ** 21n)

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
    /// ----- end of burn fees to vecrv claim contracts (curve dao side) ----

    console.log('currentRewards', BigInt(await lockFees.currentRewards()))
    await booster.earmarkFees()
    console.log('currentRewards', BigInt(await lockFees.currentRewards()))

    await threecrv.balanceOf(lockFees.address).then( a => console.log("lockFees balance: ", BigInt(a)))

    await lockFees.earned(crvWhaleAddress).then(a => console.log("earned fees: ", BigInt(a)))

    console.log("advance time...");
    await ethers.provider.send('evm_mine', [await chainTime() + DAY])
    await lockFees.earned(crvWhaleAddress).then(a => console.log("earned fees: ", BigInt(a)))

    console.log("advance time...");
    await ethers.provider.send('evm_mine', [await chainTime() + DAY])
    await lockFees.earned(crvWhaleAddress).then(a => console.log("earned fees: ", BigInt(a)))

    const balanceBefore = BigInt(await threecrv.balanceOf(crvWhaleAddress))
    await lockFees.connect(crvWhale)['getReward()']()
    const balanceAfter = BigInt(await threecrv.balanceOf(crvWhaleAddress))
    console.log('reward claimed', balanceAfter - balanceBefore, '3CRV')
  })

  it("lp staking", async function() {
    const depositAmount = 10n ** 21n

    // stake usdpCRV
    await usdpLP.connect(usdpLPWhale).approve(booster.address, depositAmount)
    await booster.connect(usdpLPWhale).deposit(USDP_POOL_ID, depositAmount, true)
    console.log('usdpCRV deposited & staked')
  })

  it("CRV claim for lp staking", async function() {
    const poolinfo = await booster.poolInfo(USDP_POOL_ID)
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
    await booster.earmarkRewards(USDP_POOL_ID)
    console.log("----earmark 1----")

    await rewardPool.earned(usdpLPWhaleAddress).then(a => console.log("claimable", BigInt(a), 'CRV'))

    console.log("advance time...")
    await ethers.provider.send('evm_mine', [await chainTime() + 6 * DAY])

    await booster.earmarkRewards(USDP_POOL_ID)
    console.log("----earmark 2----")

    await rewardPool.earned(usdpLPWhaleAddress).then(a => console.log("claimable", BigInt(a), 'CRV'))

    await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool", BigInt(a)))

    console.log("advance time...")
    await ethers.provider.send('evm_mine', [await chainTime() + 7 * DAY])
    await rewardPool.earned(usdpLPWhaleAddress).then(a => console.log("claimable", BigInt(a), 'CRV'))
    await rewardPool.connect(usdpLPWhale)['getReward()']()
    await crv.balanceOf(usdpLPWhaleAddress).then(a=>console.log("claimed", BigInt(a), 'CRV'))
  })


  it("lp staking v3", async function() {
    const depositAmount = 1000n * 10n ** 18n

    // stake cvxCRV
    await cvxcrvLP.connect(cvxcrvLPWhale).approve(booster.address, depositAmount)
    await booster.connect(cvxcrvLPWhale).deposit(CVXCRV_POOL_ID, depositAmount, true)
    console.log('cvxcrv deposited & staked')
  })

  it("CRV+additional tokens claim for lp staking v3", async function() {
    const poolinfo = await booster.poolInfo(CVXCRV_POOL_ID)
    const rewardPoolAddress = poolinfo.crvRewards
    const stashV3Address = poolinfo.stash
    const rewardPool = await ethers.getContractAt("BaseRewardPool", rewardPoolAddress)
    const depositToken = await ethers.getContractAt("DepositToken", poolinfo.token)

    expect(poolinfo.lptoken.toLowerCase()).to.be.equal(cvxcrvLPAddress)
    expect(poolinfo.gauge.toLowerCase()).to.be.equal(cvxcrvGaugeAddress)

    console.log("pool lp token " +poolinfo.lptoken)
    console.log("pool gauge " +poolinfo.gauge)
    console.log("pool reward contract at " +rewardPool.address)
    console.log("stash v3 contract at " + stashV3Address)

    let crvBalance = await crv.balanceOf(cvxcrvLPWhaleAddress)
    let cvxBalance = await cvx.balanceOf(cvxcrvLPWhaleAddress)
    expect(BigInt(cvxBalance)).to.be.equal(0n)
    console.log('before all rewards manipulations: CRV:', BigInt(crvBalance), 'CVX:', BigInt(cvxBalance))

    await depositToken.name().then(a=>console.log("deposit token name: " +a))
    await depositToken.symbol().then(a=>console.log("deposit token symbol: " +a))

    // add reward in cvx token
    expect(await rewardPool.extraRewardsLength()).to.be.equal(0);
    await cvxcrvGauge.connect(cvxcrvGaugeAdmin).add_reward(cvxAddress, cvxWhaleAddress);
    await cvx.connect(cvxWhale).approve(cvxcrvGauge.address, 1000n * 10n ** 18n)
    await cvxcrvGauge.connect(cvxWhale).deposit_reward_token(cvxAddress, 1000n * 10n ** 18n)
    expect(await rewardPool.extraRewardsLength()).to.be.equal(0);

    await ethers.provider.send('evm_mine', [await chainTime() + DAY])

    //collect and distribute rewards off gauge
    await booster.earmarkRewards(CVXCRV_POOL_ID)
    // added additional token for rewards
    expect(await rewardPool.extraRewardsLength()).to.be.equal(1);
    const extraRewardPool = await ethers.getContractAt('VirtualBalanceRewardPool', await rewardPool.extraRewards(0));
    expect((await extraRewardPool.rewardToken()).toLowerCase()).to.be.equal(cvxAddress);
    console.log("----earmark 1----")

    await rewardPool.earned(cvxcrvLPWhaleAddress).then(a => console.log("claimable", BigInt(a), 'CRV'))

    console.log("advance time...")
    await ethers.provider.send('evm_mine', [await chainTime() + 6 * DAY])

    await booster.earmarkRewards(CVXCRV_POOL_ID)
    console.log("----earmark 2----")

    await rewardPool.earned(cvxcrvLPWhaleAddress).then(a => console.log("claimable", BigInt(a), 'CRV'))

    await crv.balanceOf(rewardPool.address).then(a=>console.log("crv at reward pool", BigInt(a)))
    await cvx.balanceOf(rewardPool.address).then(a=>console.log("cvx at reward pool", BigInt(a)))

    console.log("advance time...")
    await ethers.provider.send('evm_mine', [await chainTime() + 7 * DAY])
    await rewardPool.earned(cvxcrvLPWhaleAddress).then(a => console.log("claimable", BigInt(a), 'CRV'))
    await rewardPool.connect(cvxcrvLPWhale)['getReward()']()

    crvBalance = await crv.balanceOf(cvxcrvLPWhaleAddress)
    cvxBalance = await cvx.balanceOf(cvxcrvLPWhaleAddress)
    expect(BigInt(cvxBalance) > 0n).to.be.true
    console.log('claimed: CRV:', BigInt(crvBalance), 'CVX:', BigInt(cvxBalance))
  })
})

const chainTime = async () => (await ethers.provider.getBlock('latest')).timestamp