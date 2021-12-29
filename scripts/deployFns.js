const {ethers} = require("hardhat");

const extraRewardStashV3 = '0xd7AbC64CAFc30FDd08A42Ea4bC13846be455399C'
const usdpLPAddress = '0x7eb40e450b9655f4b3cc4259bcc731c63ff55ae6'
const usdpGauge = '0x055be5DDB7A925BfEF3417FC157f53CA77cA7222'

async function deploy() {

    const voteProxy = await (await ethers.getContractFactory("CurveVoterProxy")).deploy()
    const booster = await (await ethers.getContractFactory("Booster")).deploy(voteProxy.address)
    const uveCrv = await (await ethers.getContractFactory("UVECRV")).deploy()
    const rewardFactory = await (await ethers.getContractFactory("RewardFactory")).deploy(booster.address, uveCrv.address)
    const stashFactory = await (await ethers.getContractFactory("StashFactoryV2")).deploy(booster.address, rewardFactory.address)
    const extraRewardStashV2 = await (await ethers.getContractFactory("ExtraRewardStashV2")).deploy()
    const tokenFactory = await (await ethers.getContractFactory("TokenFactory")).deploy(booster.address)
    const crvDepositor = await (await ethers.getContractFactory("CrvDepositor")).deploy(voteProxy.address, uveCrv.address)

    // initial settings
    await stashFactory.setImplementation(ethers.constants.AddressZero, extraRewardStashV2.address, extraRewardStashV3)
    await uveCrv.setOperator(crvDepositor.address)
    await booster.setFactories(rewardFactory.address, stashFactory.address, tokenFactory.address)
    await booster.setFeeInfo()

    await voteProxy.setOperator(booster.address)
    await voteProxy.setDepositor(crvDepositor.address)

    await booster.addPool(usdpLPAddress, usdpGauge, 2) // initial pool for usdplp

    // manual config
    // await crv.connect(m).transfer(voteProxy.address, 1) // transfers on voteproxy some crv for initial lock
    // await crvDepositor.initialLock()
    // await booster.voteGaugeWeight([usdpGauge], [10000])

    const contracts = {
        voteProxy,
        booster,
        uveCrv,
        rewardFactory,
        stashFactory,
        extraRewardStashV2,
        tokenFactory,
        crvDepositor
    };


    Object.keys(contracts).map(function(key, index) {
      console.log(key + ': ' + contracts[key].address)
    });

    return contracts
}

module.exports = {
    deploy
}
