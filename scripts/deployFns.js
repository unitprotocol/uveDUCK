const {ethers} = require("hardhat");

const veDistribution = '0x9f2138ccb930f0654B2C40E7e29FF8291452Eed8';
const multisig = '0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8';

async function deploy() {

    const voteProxy = await (await ethers.getContractFactory("VoterProxy")).deploy()
    await voteProxy.deployed();
    const uveDuck = await (await ethers.getContractFactory("UVEDUCK")).deploy()
    await uveDuck.deployed();
    const booster = await (await ethers.getContractFactory("Booster")).deploy(voteProxy.address)
    await booster.deployed();
    const duckDepositor = await (await ethers.getContractFactory("DuckDepositor")).deploy(voteProxy.address, uveDuck.address)
    await duckDepositor.deployed();
    const allowList = await (await ethers.getContractFactory("SmartWalletAllowList")).deploy(multisig)
    await allowList.deployed();

    // initial settings
    await uveDuck.setOperator(duckDepositor.address)

    await booster.setFeeInfo(veDistribution, uveDuck.address);

    await voteProxy.setOperator(booster.address)
    await voteProxy.setDepositor(duckDepositor.address)

    // manual config
    // await duck.connect(m).transfer(voteProxy.address, 1) // transfers on voteproxy some duck for initial lock
    // await duckDepositor.initialLock()
    
    // await veDuck.connect(unitMultisig).commit_smart_wallet_checker(allowList.address);
    // await veDuck.connect(unitMultisig).apply_smart_wallet_checker();
    // await allowList.connect(unitMultisig).approveWallet(voteProxy.address);

    // booster - owner and feemanager to multisig
    // VoterProxy - owner to multisig
    // Duck depositor - feeManager to multisig
    // SmartWalletAllowList - dao to multisig

    const contracts = {
        voteProxy,
        booster,
        uveDuck,
        duckDepositor,
        allowList
    };


    Object.keys(contracts).map(function(key, index) {
      console.log(key + ': ' + contracts[key].address)
    });

    return contracts
}

module.exports = {
    deploy
}
