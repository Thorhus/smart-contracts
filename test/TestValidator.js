const { expect } = require("chai");
const { signatoryAddress, signatoryPk, createHash } = require('./testHelpers')

describe("Validator", function () {

    let maintainersRegistry, maintainersRegistryInstance, sideBridge, sideBridgeInstance,
    validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token,
    tokenAmount = 50, nonceIncrease = 1, decimals = 18, zeroAddress = "0x0000000000000000000000000000000000000000";

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("", "", decimals);

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();
        await validatorInstance.initialize(signatoryAddress, chainportCongress.address, maintainersRegistryInstance.address);

        sideBridge = await ethers.getContractFactory("ChainportSideBridge");
        sideBridgeInstance = await sideBridge.deploy();
    });

    describe("Main functions", function () {

        let releaseAmount = 50;

        describe("Set signatory address", async function () {
            it("Should not set zero address (by congress)", async function () {
                await expect(validatorInstance.setSignatoryAddress(zeroAddress)).to.be.reverted;
            });

            it("Should set signatory address (by congress)", async function() {
                await validatorInstance.setSignatoryAddress(validatorInstance.address);
                expect(await(validatorInstance.signatoryAddress())).to.equal(validatorInstance.address);
            });

            it("Should not set signatory address (by non congress)", async function () {
                await expect(validatorInstance.connect(user1).setSignatoryAddress(user1.address))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Verify withdraw", async function () {
            it("Should not verify if message is signed using bad sig v (by invalid signer)", async function () {
                await expect(validatorInstance.recoverSigFromHash(
                    "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cd",
                    "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cdcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cdcf36")
                ).to.be.revertedWith("bad sig v");
            });

            xit("Should return false if message is signed (by invalid signer)", async function () {
                expect(await validatorInstance.recoverSigFromHash(
                    "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cd",
                    "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cdcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cdcf36")
                ).to.be.false;
            });

            it("Should verify signature", async () => {
                expect(await validatorInstance.verifyWithdraw(
                    createHash(1, maintainer.address, releaseAmount, token.address, signatoryPk),
                    1,
                    maintainer.address,
                    releaseAmount,
                    token.address
                )).to.be.true;
            });
        });

        describe("Recover signature from hash", async () => {
            xit("Case", async () => {
                expect(await validatorInstance.recoverSigFromHash())
                    .to.be.true;
            })
        });

        describe("Recover signature", async function () {
            it("Should return recovered signature", async () => {
                await validatorInstance.recoverSignature(
                    createHash(1, maintainer.address, releaseAmount, token.address, signatoryPk),
                    1,
                    maintainer.address,
                    releaseAmount,
                    token.address
                ).then(console.log)
                console.log(await validatorInstance.signatoryAddress())
            });
        });
    });
});
