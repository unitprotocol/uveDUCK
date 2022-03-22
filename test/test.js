const chai = require("chai")
const {solidity} = require("ethereum-waffle")
chai.use(solidity)
const {ethers} = require('hardhat')
const {deploy} = require("../scripts/deployFns");
const {expect} = require("chai");

const DAY = 86400
const WEEK = 7 * DAY

const duckWhaleAddress = '0x3976cdc41f34466ebb7efa2fd097d3eab808ea65'

const unitVaultAddress = '0xb1cFF81b9305166ff1EFc49A129ad2AfCd7BCf19'
const unitMultisigAddress = '0xae37E8f9a3f960eE090706Fa4db41Ca2f2C56Cb8';

const veDuckAddress = '0x48DdD27a4d54CD3e8c34F34F7e66e998442DBcE3'
const veDistributionAddress = '0x9f2138ccb930f0654B2C40E7e29FF8291452Eed8'
const duckAddress = '0x92E187a03B6CD19CB6AF293ba17F2745Fd2357D5';
const usdpAddress = '0x1456688345527bE1f37E9e627DA0837D6f08C925';
const wethAddress = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

const treasuryAddress = '0x0000000000000000000000000000000000000003';

let duck, admin, user1, user2, user3, duckWhale,
    usdp, veDuck, veDistribution;

let voteProxy, booster, uveDuck, allowList,
    duckDepositor, suveDuck, unitMultisig

let oracleRegistry, cdpManager, wrappedToUnderlyingOracle, unitParameters

const duckDepositAmount = 10n ** 6n * 10n ** 18n

describe("Functional test", function () {

    before(async function () {
        ;[admin, user1, user2, user3] = await ethers.getSigners()

        duck = await ethers.getContractAt("IERC20", duckAddress)
        veDuck = await ethers.getContractAt("IVoteEscrow", veDuckAddress)
        usdp = await ethers.getContractAt("IERC20", usdpAddress)
        veDistribution = await ethers.getContractAt("IVeDistribution", veDistributionAddress)

        oracleRegistry = await ethers.getContractAt("IOracleRegistry", '0x75fBFe26B21fd3EA008af0C764949f8214150C8f')
        cdpManager = await ethers.getContractAt("ICDPManager01", '0x69FB4D4e3404Ea023F940bbC547851681e893a91')
        wrappedToUnderlyingOracle = await ethers.getContractAt("IWrappedToUnderlyingOracle", '0x220Ea780a484c18fd0Ab252014c58299759a1Fbd')
        unitParameters = await ethers.getContractAt("IParametersBatchUpdater", '0x4DD1A6DB148BEcDADAdFC407D23b725eDd3cfB6f')

        await ethers.provider.send("hardhat_impersonateAccount", [duckWhaleAddress]);
        duckWhale = await ethers.getSigner(duckWhaleAddress)
        await ethers.provider.send("hardhat_setBalance", [duckWhaleAddress, '0x3635c9adc5dea00000' /* 1000Ether */]);

        await ethers.provider.send("hardhat_impersonateAccount", [unitMultisigAddress]);
        unitMultisig = await ethers.getSigner(unitMultisigAddress)
        await ethers.provider.send("hardhat_setBalance", [unitMultisigAddress, '0x3635c9adc5dea00000' /* 1000Ether */]);

        (
            {
                voteProxy,
                booster,
                uveDuck,
                duckDepositor,
                allowList
            } = await deploy()
        );

        await veDuck.connect(unitMultisig).commit_smart_wallet_checker(allowList.address);
        await veDuck.connect(unitMultisig).apply_smart_wallet_checker();
        await allowList.connect(unitMultisig).approveWallet(voteProxy.address);

        await booster.setTreasury(treasuryAddress);

        suveDuck = await ethers.getContractAt("FeePool", await booster.lockFees())
    })

    it("DUCK -> UVEDUCK", async function () {

        await duck.connect(duckWhale).transfer(voteProxy.address, 1) // transfers on voteproxy some duck for initial lock

        await duckDepositor.initialLock()
        await duck.connect(duckWhale).approve(duckDepositor.address, duckDepositAmount)

        const depositResult1 = await duckDepositor.connect(duckWhale)['deposit(uint256,address)'](duckDepositAmount, suveDuck.address)
        console.log('Deposit gas used', (await depositResult1.wait()).gasUsed.toString())
    })

    it("usdp claim for UVEDUCK provided as collateral on Unit", async function () {

        // add SUVEDUCK as collateral on Unit Protocol (unit side)
        await oracleRegistry.connect(unitMultisig).setOracleTypeForAsset(suveDuck.address, 11)
        // duck uses keydonix oracle ATM (we can't test it with hardhat)
        // so for test reasons we use weth price
        await wrappedToUnderlyingOracle.connect(unitMultisig).setUnderlying(suveDuck.address, wethAddress)
        await unitParameters.connect(unitMultisig).setCollaterals([suveDuck.address], 0, 0, 50, 75, 0, 1100, 10n ** 23n, [11])

        // provide collateral and mint some USDP
        await suveDuck.connect(duckWhale).approve(unitVaultAddress, duckDepositAmount)
        await usdp.connect(duckWhale).approve(cdpManager.address, 10n ** 20n)
        await cdpManager.connect(duckWhale).join(suveDuck.address, duckDepositAmount, 10n ** 21n)

        await usdp.connect(duckWhale).transfer(user2.address, 10n**20n)

        // usdp claim
        await booster.connect(user3).earmarkFees();
        console.log("----------- initial fees earmarked")
        await printBalances();

        await ethers.provider.send('evm_mine', [await chainTime() + WEEK + WEEK + DAY])
        console.log("----------- 2 weeks later")

        // send some fees to veDsitribution
        await usdp.connect(user2).transfer(veDistribution.address, 10n**20n);
        await veDistribution.checkpoint_token();
        await veDistribution.checkpoint_total_supply();
        console.log("----------- fees sent to veDistributions")

        expect(await usdp.balanceOf(treasuryAddress)).to.be.equal(0)
        expect(await usdp.balanceOf(user3.address)).to.be.equal(0)
        await printBalances();
        await booster.connect(user3).earmarkFees()
        console.log("----------- fees earmarked")
        await printBalances();
        const treasuryUsdpBalance = await usdp.balanceOf(treasuryAddress)
        const senderUsdpBalance = await usdp.balanceOf(user3.address)
        const suveDuckUsdpBalance = await usdp.balanceOf(suveDuck.address)
        expect(treasuryUsdpBalance).to.be.closeTo(senderUsdpBalance.mul(10), 100) // treasury 10%, sender 1%
        expect(senderUsdpBalance.add(suveDuckUsdpBalance)).to.be.closeTo(treasuryUsdpBalance.mul(9), 100) // rest 89% sent to distribution 1+89 = 10*9


        await ethers.provider.send('evm_mine', [await chainTime() + DAY])
        console.log("----------- 1 day later");
        await printBalances();

        await ethers.provider.send('evm_mine', [await chainTime() + DAY])
        console.log("----------- 1 day later");
        await printBalances();

        const balanceBefore = BigInt(await usdp.balanceOf(duckWhaleAddress))
        await suveDuck.connect(duckWhale)['getReward()']()
        const balanceAfter = BigInt(await usdp.balanceOf(duckWhaleAddress))
        console.log('----------- reward claimed', balanceAfter - balanceBefore, 'usdp')
        await printBalances();

        await ethers.provider.send('evm_mine', [await chainTime() + 5 * DAY])
        console.log("----------- 5 days later");
        await suveDuck.connect(duckWhale)['getReward()']()
        const balanceAfter2 = BigInt(await usdp.balanceOf(duckWhaleAddress))
        console.log('----------- total reward claimed', balanceAfter2 - balanceBefore, 'usdp')
        await printBalances();
        expect(balanceAfter2 - balanceBefore).to.be.closeTo(suveDuckUsdpBalance, 1_000_000)
    })
})

const chainTime = async () => (await ethers.provider.getBlock('latest')).timestamp

async function printBalances() {
    await suveDuck.currentRewards().then(a => console.log("== suveDuck currentRewards: ", BigInt(a)))
    await usdp.balanceOf(suveDuck.address).then(a => console.log("== suveDuck usdp balance: ", BigInt(a)))
    await usdp.balanceOf(duckWhale.address).then(a => console.log("== user usdp balance: ", BigInt(a)))
    await suveDuck.earned(duckWhaleAddress).then(a => console.log("== user earned fees: ", BigInt(a)))
}