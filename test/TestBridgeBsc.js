const { expect } = require("chai");

describe("Bridge Binance Side", function () {

    let maintainersRegistry, maintainersRegistryInstance;
    let bridgeBsc, bridgeBscInstance;
    let validator, validatorInstance;
    let chainportCongress;
    let maintainer, maintainers;
    let user1, user2;
    let token;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("","",5);

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();

        bridgeBsc = await ethers.getContractFactory("ChainportBridgeBsc");
        bridgeBscInstance = await bridgeBsc.deploy();
    });

    it("Initialization", async function () {
        await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
    });

    describe("Main functions", function () {

        beforeEach(async function () {
            await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await bridgeBscInstance.connect(chainportCongress).unfreezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(bridgeBscInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await expect(bridgeBscInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not unfreeze the bridge (by maintianer)", async function () {
                await bridgeBscInstance.connect(maintainer).freezeBridge();
                expect(await bridgeBscInstance.isFrozen()).to.equal(true);
                await expect(bridgeBscInstance.connect(maintainer).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Token Minting", function () {
            it("Should mint a new token (by maintainer)", async function () {
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", 5);
            });

            it("Should not mint same token second time", async function () {
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", 5);
                await expect(bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", 5))
                    .to.be.revertedWith("MintNewToken: Token already exists.");
            });

            it("Should not mint a new token (by user)", async function () {
                await expect(bridgeBscInstance.connect(user1).mintNewToken(token.address, "", "", 5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should mint tokens", async function () {
                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");

                await bridgeBscInstance.connect(maintainer).mintTokens(token.address, user1.address, 3, lastNonce + 1);
            });
        });

        describe("Token Burning", function () {
            xit("Should burn a token made by the bridge (by maintainer)", async function () {
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", 5);
                await bridgeBscInstance.connect(maintainer).burnTokens(
                    await bridgeBscInstance.erc20ToBep20Address(token.address), 1);
            });

            xit("Should not burn a token (by user)", async function () {
                await bridgeBscInstance.connect(maintainer).mintNewToken(token.address, "", "", 5);
                await expect(bridgeBscInstance.connect(user1).burnTokens(
                    await bridgeBscInstance.erc20ToBep20Address(token.address), 1))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not burn a token which was not created by the bridge", async function () {
                await expect(bridgeBscInstance.connect(maintainer).burnTokens(
                    await bridgeBscInstance.erc20ToBep20Address(token.address), 1))
                    .to.be.revertedWith("BurnTokens: Token is not created by the bridge.");
            });
        });
    });
});
