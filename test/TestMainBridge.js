const { expect } = require("chai");
const { signatoryAddress, signatoryPk, createHash } = require('./testHelpers')

describe("Main Bridge Test", function () {

    let maintainersRegistry, maintainersRegistryInstance, mainBridge, mainBridgeInstance, coldWallet,
        validator, validatorInstance, chainportCongress, maintainer, maintainers, user1, user2, token,
        tokenAmount = 50, nonceIncrease = 1, decimals = 18, freezeLength = 60, safetyThreshold = 30;

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    beforeEach(async function() {

        [chainportCongress, user1, user2, maintainer, coldWallet, ...maintainers] = await ethers.getSigners();
        maintainersRegistry = await ethers.getContractFactory("MaintainersRegistry");

        coldWallet = coldWallet.address;

        maintainersRegistryInstance = await maintainersRegistry.deploy();
        for(let i = 0; i < maintainers.length; i++) {
            maintainers[i] = maintainers[i].address;
        }

        maintainers[maintainers.length] = maintainer.address;

        await maintainersRegistryInstance.initialize(maintainers, chainportCongress.address);

        token = await ethers.getContractFactory("BridgeMintableToken");
        token = await token.deploy("", "", decimals);

        validator = await ethers.getContractFactory("Validator");
        validatorInstance = await validator.deploy();
        await validatorInstance.initialize(signatoryAddress, user1.address, user2.address)

        mainBridge = await ethers.getContractFactory("ChainportMainBridge");
        mainBridgeInstance = await mainBridge.deploy();
    });

    describe("Initialization", function () {

        it("Should not initialize when safetyThreshold is 0", async function () {
            await expect(mainBridgeInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                0
            )).to.be.revertedWith("Error: % is not valid.");
        });

        it("Should initialize", async function () {
            await mainBridgeInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                0,
                30
            )
        });
    });

    describe("Functions", function () {

        beforeEach(async function () {
            await mainBridgeInstance.initialize(
                maintainersRegistryInstance.address,
                chainportCongress.address,
                validatorInstance.address,
                60,
                30
            );
        });

        describe("Check if values are set properly", function () {

            it("Maintainers registry is set properly", async function () {
                expect(await mainBridgeInstance.maintainersRegistry()).to.equal(maintainersRegistryInstance.address);
            });

            it("Chainport congress address is set properly", async function () {
                expect(await mainBridgeInstance.chainportCongress()).to.equal(chainportCongress.address);
            });

            it("Validator address is set properly", async function () {
                expect(await mainBridgeInstance.signatureValidator()).to.equal(validatorInstance.address);
            });

            it("Freeze length is set properly", async function () {
                expect(await mainBridgeInstance.freezeLength()).to.equal(freezeLength);
            });

            it("Safety threshold is set properly", async function () {
                expect(await mainBridgeInstance.safetyThreshold()).to.equal(safetyThreshold);
            });
        });

        describe("Asset protection", function () {

            it("Should protect the asset (by congress)", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(true);
            });

            it("Should remove protection on the asset (by congress)", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(true);
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, false);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(false);
            });

            it("Should not protect the asset (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).setAssetProtection(token.address, true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not remove protection on the asset (by user)", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetProtection(token.address, true);
                expect(await mainBridgeInstance.isAssetProtected(token.address)).to.equal(true);
                await expect(mainBridgeInstance.connect(user1).setAssetProtection(token.address, false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should protect asset by maintainer", async function () {
                await expect(mainBridgeInstance.connect(maintainer).protectAssetByMaintainer(token.address))
                    .to.emit(mainBridgeInstance, 'AssetProtected')
                    .withArgs(token.address, true);
            });

            it("Should not protect asset by maintainer (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).protectAssetByMaintainer(token.address))
                    .to.be.reverted;
            });
        });

        describe("Bridge Freezing Operations", function () {

            it("Should freeze the bridge (by maintainer)", async function () {
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);
            });

            it("Should unfreeze the bridge (by congress)", async function () {
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);
                await mainBridgeInstance.connect(chainportCongress).unfreezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(false);
            });

            it("Should not let freeze the bridge (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).freezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
            });

            it("Should not let unfreeze the bridge (by user)", async function () {
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);
                await expect(mainBridgeInstance.connect(user1).unfreezeBridge())
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Assete freezing operations", function () {
            it("Freeze asset by maintainer", async function () {
                await expect(mainBridgeInstance.connect(maintainer).freezeAssetByMaintainer(token.address))
                    .to.emit(mainBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address,true);
            });

            it("Should not freeze asset by user", async function () {
                await expect(mainBridgeInstance.connect(user1).freezeAssetByMaintainer(token.address))
                    .to.be.reverted;
            });

            it("Should freeze asset by congress", async function () {
                 await expect(mainBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true))
                     .to.emit(mainBridgeInstance, 'AssetFrozen')
                     .withArgs(token.address, true);
            });

            it("Should not unfreeze asset by user or maintainer", async function () {
                await mainBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, true);
                await expect(mainBridgeInstance.connect(user1).setAssetFreezeState(token.address, false))
                    .to.be.reverted;
            });

            it("Should unfreeze asset by congress", async function () {
                await expect(mainBridgeInstance.connect(chainportCongress).setAssetFreezeState(token.address, false))
                    .to.emit(mainBridgeInstance, 'AssetFrozen')
                    .withArgs(token.address, false);
            });
        });

        describe("Network activation", function () {

            it("Should activate network (as maintainer)", async function () {
                await expect(mainBridgeInstance.connect(maintainer).activateNetwork(1))
                    .to.emit(mainBridgeInstance, 'NetworkActivated')
                    .withArgs(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.true;
            });

            it("Should not activate network (as user)", async function () {
                await expect(mainBridgeInstance.connect(user1).activateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to Maintainer');
            });

            it("Should deactivate network (as congress)", async function () {
                await expect(mainBridgeInstance.connect(maintainer).activateNetwork(1))
                    .to.emit(mainBridgeInstance, 'NetworkActivated')
                    .withArgs(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(mainBridgeInstance.connect(chainportCongress).deactivateNetwork(1))
                    .to.emit(mainBridgeInstance, 'NetworkDeactivated')
                    .withArgs(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.false;
            });

            it("Should not deactivate network (as user)", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                expect(await mainBridgeInstance.isNetworkActive(1)).to.be.true;
                await expect(mainBridgeInstance.connect(user1).deactivateNetwork(1))
                    .to.be.revertedWith('ChainportUpgradables: Restricted only to ChainportCongress');
            });
        });

        describe("Time Lock Setting", function () {

            let newFreezeLength = 120;

            it("Should set time lock (by congress)", async function () {
                await expect(mainBridgeInstance.connect(chainportCongress).setTimeLockLength(newFreezeLength))
                    .to.emit(mainBridgeInstance, 'TimeLockLengthChanged')
                    .withArgs(newFreezeLength);
                expect(await mainBridgeInstance.freezeLength()).to.equal(newFreezeLength);
            });

            it("Should not set time lock (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).setTimeLockLength(newFreezeLength))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not set time lock (by maintainer)", async function () {
                await expect(mainBridgeInstance.connect(maintainer).setTimeLockLength(newFreezeLength))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Safety Threshold Setting", function () {

            let newSafetyThreshold = 50;

            it("Should set safety threshold (by congress)", async function () {
                await expect(mainBridgeInstance.connect(chainportCongress).setThreshold(newSafetyThreshold))
                    .to.emit(mainBridgeInstance, 'SafetyThresholdChanged')
                    .withArgs(newSafetyThreshold);
                expect(await mainBridgeInstance.safetyThreshold()).to.equal(newSafetyThreshold);
            });

            it("Should not set safety threshold (by user)", async function () {
                await expect(mainBridgeInstance.connect(user1).setThreshold(newSafetyThreshold))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });

            it("Should not set safety threshold (by maintainer)", async function () {
                await expect(mainBridgeInstance.connect(maintainer).setThreshold(newSafetyThreshold))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });

        describe("Token Depositing", function () {

            beforeEach(async function () {
                let sideBridgeInstance = await ethers.getContractFactory("ChainportSideBridge");
                sideBridgeInstance = await sideBridgeInstance.deploy();

                await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);

                await token.connect(user1).approve(mainBridgeInstance.address, tokenAmount);

            });

            it("Should deposit the token to specified bridge", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.emit(mainBridgeInstance, 'TokensDeposited')
                    .withArgs(token.address, user1.address , tokenAmount - 1, 1);
            });

            it("Should not deposit the token to specified bridge (network not active)", async function () {
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.be.revertedWith("Error: Network with this id is not supported.");
            });

            it("Should not deposit the token if the amount to freeze is more than the account balance", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount + 1, 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });

            it("Should not deposit if amount is below or equal to zero", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, 0, 1))
                    .to.be.revertedWith("Amount is not greater than zero.");
            });

            it("Should not deposit the token if exceeds balance", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount + 1, 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds balance");
            });

            it("Should not deposit the token if exceeds allowance", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await token.connect(user1).approve(mainBridgeInstance.address, 0);

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
            });

            it("Should not deposit the token if bridge is frozen", async function () {
                await mainBridgeInstance.connect(maintainer).activateNetwork(1);
                await mainBridgeInstance.connect(maintainer).freezeBridge();
                expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, 10, 1))
                    .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
            });
        });

        describe("Token Releasing (Withdrawal)", function () {

            let releaseAmount = 20;

            beforeEach(async function () {
                let sideBridgeInstance = await ethers.getContractFactory("ChainportSideBridge");
                sideBridgeInstance = await sideBridgeInstance.deploy();

                await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer)
                    .mintTokens(token.address, user1.address, tokenAmount, lastNonce + nonceIncrease);

                await token.connect(user1).approve(mainBridgeInstance.address, tokenAmount);

                await mainBridgeInstance.connect(maintainer).activateNetwork(1);

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount, 1))
                    .to.emit(mainBridgeInstance, 'TokensDeposited')
                    .withArgs(token.address, user1.address , tokenAmount, 1);
            });

            describe("Release Tokens By Maintainer", function (){

                beforeEach(async () => {
                    await mainBridgeInstance.connect(chainportCongress).setColdWallet(coldWallet);
                });

                it("Should not withdraw when singature length is not right (by maintainer)", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                    )).to.be.revertedWith("bad signature length");
                });

                xit("Should not withdraw tokens when sig v is not right (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cd", // Needs proper signature
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                    );
                });

                xit("Should not withdraw tokens when sig s is not right (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        "0xcf36ac4f97dc10d91fc2cbb20d718e94a8cbfe0f82eaedc6a4aa38946fb797cd", // Needs proper signature
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokensByMaintainer") + 1
                    );
                });

                it("Should not withdraw when bridge is frozen (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).freezeBridge();
                    expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        createHash(1, coldWallet, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    )).to.be.revertedWith("Error: All Bridge actions are currently frozen.");
                });

                it("Should not withdraw when amount is less or equal to zero (by maintainer)", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        createHash(1, coldWallet, 0, token.address),
                        token.address,
                        0,
                        1
                    )).to.be.revertedWith("Amount is not greater than zero.");
                });

                it("Should withdraw tokens using signature (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        createHash(1, coldWallet, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    );
                });

                it("Should not withdraw tokens using signature used (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        createHash(1, coldWallet, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    );
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensByMaintainer(
                        createHash(1, coldWallet, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    )).to.be.revertedWith("Already used signature.");
                });
            });

            describe("Release Tokens Time Lock Passed", function () {

                it("Should release tokens if time lock passed", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensTimelockPassed(
                        createHash(1, maintainer.address, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    )).to.be.revertedWith("Invalid function call");
                });

                xit("Should release tokens if time lock passed", async function () {
                    await mainBridgeInstance.connect(maintainer).releaseTokensTimelockPassed(
                        createHash(1, maintainer.address, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    );
                });

                xit("Should not withdraw when singature length is not right", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensTimelockPassed(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokensTimelockPassed") + 1
                    )).to.be.revertedWith("bad signature length");
                });

                it("Should not withdraw when bridge is frozen (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).freezeBridge();
                    expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensTimelockPassed(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokensTimelockPassed") + 1
                    )).to.be.revertedWith("Error: All Bridge actions are currently frozen.");
                });

                it("Should not withdraw when amount is less or equal to zero", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokensTimelockPassed(
                        "0x00",
                        token.address,
                        0,
                        await mainBridgeInstance.functionNameToNonce("releaseTokensTimelockPassed") + 1
                    )).to.be.revertedWith("Amount is not greater than zero.");
                });
            });

            describe("Release Tokens", function () {

                it("Should release tokens", async function () {
                    await mainBridgeInstance.connect(user1).releaseTokens(
                        createHash(1, user1.address, releaseAmount, token.address),
                        token.address,
                        releaseAmount,
                        1
                    );
                });

                it("Should not withdraw when singature length is not right", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokens(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokens") + 1
                    )).to.be.revertedWith("bad signature length");
                });

                it("Should not withdraw when bridge is frozen (by maintainer)", async function () {
                    await mainBridgeInstance.connect(maintainer).freezeBridge();
                    expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                    await expect(mainBridgeInstance.connect(maintainer).releaseTokens(
                        "0x00",
                        token.address,
                        releaseAmount,
                        await mainBridgeInstance.functionNameToNonce("releaseTokens") + 1
                    )).to.be.revertedWith("Error: All Bridge actions are currently frozen.");
                });

                it("Should not withdraw when amount is less or equal to zero", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).releaseTokens(
                        "0x00",
                        token.address,
                        0,
                        await mainBridgeInstance.functionNameToNonce("releaseTokens") + 1
                    )).to.be.revertedWith("Amount is not greater than zero.");
                });
            });

            describe("Approve Withdrawal And Transfer Funds", function () {

                it("Should approve withdrawal and transfer funds (by congress)", async function () {
                    await expect(mainBridgeInstance.connect(chainportCongress).approveWithdrawalAndTransferFunds(token.address)).to.be.reverted;
                });

                xit("Should approve withdrawal and transfer funds (by congress)", async function () {
                    await mainBridgeInstance.connect(chainportCongress).approveWithdrawalAndTransferFunds(token.address);
                });

                it("Should not approve withdrawal and transfer funds (by maintainer)", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).approveWithdrawalAndTransferFunds(token.address))
                        .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
                });

                it("Should not approve withdrawal and transfer funds (by user)", async function () {
                    await expect(mainBridgeInstance.connect(user1).approveWithdrawalAndTransferFunds(token.address))
                        .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
                });

                it("Should not approve withdrawal and transfer funds when bridge is frozen", async function () {
                    await mainBridgeInstance.connect(maintainer).freezeBridge();
                    expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                    await expect(mainBridgeInstance.connect(chainportCongress).approveWithdrawalAndTransferFunds(token.address))
                        .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
                });
            });

            describe("Reject Withdrawal", function () {

                it("Should reject withdrawal (by congress)", async function () {
                    await expect(mainBridgeInstance.connect(chainportCongress).rejectWithdrawal(token.address)).to.be.reverted;
                });

                xit("Should reject withdrawal (by congress)", async function () {
                    await mainBridgeInstance.connect(chainportCongress).rejectWithdrawal(token.address);
                });

                it("Should not reject withdrawal (by maintainer)", async function () {
                    await expect(mainBridgeInstance.connect(maintainer).rejectWithdrawal(token.address))
                        .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
                });

                it("Should not reject withdrawal (by user)", async function () {
                    await expect(mainBridgeInstance.connect(user1).rejectWithdrawal(token.address))
                        .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
                });

                it("Should not reject withdrawal when bridge is frozen", async function () {
                    await mainBridgeInstance.connect(maintainer).freezeBridge();
                    expect(await mainBridgeInstance.isFrozen()).to.equal(true);

                    await expect(mainBridgeInstance.connect(chainportCongress).rejectWithdrawal(token.address))
                        .to.be.revertedWith("Error: All Bridge actions are currently frozen.");
                });
            });
        });

        describe("Checking amount compared to threshold", function () {

            beforeEach(async function () {
                let sideBridgeInstance = await ethers.getContractFactory("ChainportSideBridge");
                sideBridgeInstance = await sideBridgeInstance.deploy();

                await sideBridgeInstance.initialize(chainportCongress.address, maintainersRegistryInstance.address);

                await token.connect(chainportCongress).setSideBridgeContract(sideBridgeInstance.address);
                let lastNonce = await sideBridgeInstance.functionNameToNonce("mintTokens");
                await sideBridgeInstance.connect(maintainer)
                    .mintTokens(token.address, mainBridgeInstance.address, tokenAmount*100, lastNonce + nonceIncrease);
            });

            it("Should check if amount is below safety threshold", async function () {
                expect(await mainBridgeInstance.isAboveThreshold(token.address, tokenAmount*10)).to.be.false;
            });

            it("Should check if amount is above safety threshold", async function () {
                expect(await mainBridgeInstance.isAboveThreshold(token.address, tokenAmount*55)).to.be.true;
            });
        });

        describe("Path Pause Flow", function(){

            it("Should pause path by maintainer", async function () {
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
            });

            it("Should not perform function when funnel is paused", async function () {

                await mainBridgeInstance.connect(maintainer).activateNetwork(1);

                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;

                await expect(mainBridgeInstance.connect(user1).depositTokens(token.address, tokenAmount - 1, 1))
                    .to.be.revertedWith("Error: Path is paused.");
            });

            it("Should not pause path by user", async function () {
                await expect(mainBridgeInstance.connect(user1).setPathPauseState(token.address, "depositTokens", true))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.false;
            });

            it("Should unpause funnel by maintainer", async function () {
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", false);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.false;
            });

            it("Should not unpause path by user", async function () {
                await mainBridgeInstance.connect(maintainer).setPathPauseState(token.address, "depositTokens", true);
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
                await expect(mainBridgeInstance.connect(user1).setPathPauseState(token.address, "depositTokens", false))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to Maintainer");
                expect(await mainBridgeInstance.isPathPaused(token.address, "depositTokens")).to.be.true;
            });
        });

        describe("Set cold wallet function test", () => {
            it("Should set new cold wallet by congress", async () => {
                expect(await mainBridgeInstance.coldWallet()).to.equal(ZERO_ADDRESS);
                await mainBridgeInstance.connect(chainportCongress).setColdWallet(coldWallet);
                expect(await mainBridgeInstance.coldWallet()).to.equal(coldWallet);
            });
            it("Should not set new cold wallet by non congress wallet", async () => {
                expect(await mainBridgeInstance.coldWallet()).to.equal(ZERO_ADDRESS);
                await expect(mainBridgeInstance.connect(user1).setColdWallet(coldWallet))
                    .to.be.revertedWith("ChainportUpgradables: Restricted only to ChainportCongress");
            });
        });
    });
});
