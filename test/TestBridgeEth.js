const { expect } = require("chai");

describe("Bridge Ethereum Side", function () {

    let maintainersRegistry, maintainersRegistryInstance, bridgeEth, bridgeEthInstance,
    validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token,
    tokenAmount = 50, nonceIncrease = 1, decimals = 18;

    beforeEach(async function() {
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");
        [chainportCongress, user1, user2, maintainer, ...maintainers] = await ethers.getSigners();

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("","",decimals);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();

        bridgeEth = await ethers.getContractFactory("ChainportBridgeEth");
        bridgeEthInstance = await bridgeEth.deploy();
    });

    describe("Initialization", function () {

        it("Should not initialize when safetyThreshold is 0", async function () {
            await expect(bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                0
            )).to.be.revertedWith("Error: % is not valid.");
        });

        it("Should initialize", async function () {
            await bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                30
            )
        });
    });

    describe("Main Functions", function () {

        beforeEach(async function () {
            await bridgeEthInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                60,
                30
            );
        });

        describe("Asset protection", function () {

            it("Should protect the asset (by congress)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(true);
            });

            it("Should remove protection on the asset (by congress)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(true);
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, false);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(false);
            });

            it("Should not protect the asset (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).setAssetProtection(token.address, true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not remove protection on the asset (by user)", async function () {
                await bridgeEthInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await bridgeEthInstance.isAssetProtected(token.address)).to.equal(true);
                await expect(bridgeEthInstance.connect(user1).setAssetProtection(token.address, false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);
                await bridgeEthInstance.connect(chainportCongress).unfreezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);
                await expect(bridgeEthInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Time Lock Setting", function () {

            it("Should set time lock (by congress)", async function () {
                await expect(bridgeEthInstance.connect(chainportCongress).setTimeLockLength(5))
                    .to.emit(bridgeEthInstance, 'TimeLockLengthChanged')
                    .withArgs(5);
                expect(await bridgeEthInstance.timeLockLength()).to.equal(5);
            });

            it("Should not set time lock (by user)", async function () {
               await expect(bridgeEthInstance.connect(user1).setTimeLockLength(5))
                   .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not set time lock (by maintainer)", async function () {
                await expect(bridgeEthInstance.connect(maintainer).setTimeLockLength(5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Safety Threshold Setting", function () {

            it("Should set safety threshold (by congress)", async function () {
                await expect(bridgeEthInstance.connect(chainportCongress).setThreshold(7))
                    .to.emit(bridgeEthInstance, 'SafetyThresholdChanged')
                    .withArgs(7);
                expect(await bridgeEthInstance.safetyThreshold()).to.equal(7);
            });

            it("Should not set safety threshold (by user)", async function () {
                await expect(bridgeEthInstance.connect(user1).setThreshold(5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not set safety threshold (by maintainer)", async function () {
                await expect(bridgeEthInstance.connect(maintainer).setThreshold(5))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Token Freezing", function () {

            beforeEach(async function () {
                let bridgeBscInstance = await ethers.getContractFactory("ChainportBridgeBsc");
                bridgeBscInstance = await bridgeBscInstance.deploy();

                await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);

                await token.connect(user1).approve(bridgeEthInstance.address, tokenAmount);
            });
            it("Should freeze the token", async function () {
                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, tokenAmount - 1))
                    .to.emit(bridgeEthInstance, 'TokensFreezed')
                    .withArgs(token.address, user1.address , tokenAmount - 1);
            });

            it("Should not freeze if amount is below or equal to zero", async function () {
                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, 0))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not freeze the token if exceeds balance", async function () {
                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, tokenAmount + 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });

            it("Should not freeze the token if exceeds allowance", async function () {
                await token.connect(user1).approve(bridgeEthInstance.address, 0);

                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, tokenAmount - 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
            });

            it("Should not freeze the token if bridge is frozen", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);

                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, 10))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });
        });

        describe("Token Releasing (Withdrawal)", function () {

            beforeEach(async function () {
                let bridgeBscInstance = await ethers.getContractFactory("ChainportBridgeBsc");
                bridgeBscInstance = await bridgeBscInstance.deploy();

                await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);

                await token.connect(user1).approve(bridgeEthInstance.address, tokenAmount);

                await expect(bridgeEthInstance.connect(user1).freezeToken(token.address, tokenAmount))
                    .to.emit(bridgeEthInstance, 'TokensFreezed')
                    .withArgs(token.address, user1.address , tokenAmount);
            });

            xit("Should withdraw tokens using signature (by maintainer)", async function () {
                await bridgeEthInstance.connect(maintainer).releaseTokensByMaintainer(
                    "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cde", // Needs proper signature
                    token.address,
                    5,
                    maintainer.address,
                    await bridgeEthInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                );
            });

            it("Should not withdraw when singature length is not right (by maintainer)", async function () {
                await expect(bridgeEthInstance.connect(maintainer).releaseTokensByMaintainer(
                    "0x00",
                    token.address,
                    5,
                    maintainer.address,
                    await bridgeEthInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                )).to.be.revertedWith("bad signature length");
            });

            it("Should not withdraw when bridge is frozen (by maintainer)", async function () {
                await bridgeEthInstance.connect(maintainer).freezeBridge();
                expect(await bridgeEthInstance.isFrozen()).to.equal(true);

                await expect(bridgeEthInstance.connect(maintainer).releaseTokensByMaintainer(
                    "0x00",
                    token.address,
                    5,
                    maintainer.address,
                    await bridgeEthInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                )).to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });

            it("Should not withdraw when amount is less or equal to zero (by maintainer)", async function () {
                await expect(bridgeEthInstance.connect(maintainer).releaseTokensByMaintainer(
                    "0x00",
                    token.address,
                    0,
                    maintainer.address,
                    await bridgeEthInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                )).to.be.revertedWith("Amount is not greater than zero.");
            });
        });

        describe("Checking amount compared to threshold", function () {

            beforeEach(async function () {
                let bridgeBscInstance = await ethers.getContractFactory("ChainportBridgeBsc");
                bridgeBscInstance = await bridgeBscInstance.deploy();

                await bridgeBscInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                let lastNonce = await bridgeBscInstance.functionNameToNonce("mintTokens");
                await bridgeBscInstance.connect(maintainer)
                    .mintTokens(token.address, bridgeEthInstance.address, tokenAmount*100, lastNonce + nonceIncrease);
            });

            it("Should check if amount is below safety threshold", async function () {
                expect(await bridgeEthInstance.isAboveThreshold(token.address, tokenAmount*10)).to.be.false;
            });

            it("Should check if amount is above safety threshold", async function () {
                expect(await bridgeEthInstance.isAboveThreshold(token.address, tokenAmount*55)).to.be.true;
            });
        });
    });
});