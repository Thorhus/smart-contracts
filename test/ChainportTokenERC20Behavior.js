const { ethers, expect, isEthException, awaitTx, toChainportDenomination } = require('./setup')
const config = require('../deployments/deploymentConfig.json');
const hre = require('hardhat');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const INITIAL_SUPPLY = toChainportDenomination(config['local'].totalSupply)
const transferAmount = toChainportDenomination(10)
const unitTokenAmount = toChainportDenomination(1)

const overdraftAmount = INITIAL_SUPPLY.add(unitTokenAmount)
const overdraftAmountPlusOne = overdraftAmount.add(unitTokenAmount)
const overdraftAmountMinusOne = overdraftAmount.sub(unitTokenAmount)
const transferAmountPlusOne = transferAmount.add(unitTokenAmount)
const transferAmountMinusOne = transferAmount.sub(unitTokenAmount)

let chainportToken, owner, ownerAddr, anotherAccount, anotherAccountAddr, recipient, recipientAddr, r

async function setupContractAndAccounts () {
    let accounts = await ethers.getSigners()
    owner = accounts[0]
    ownerAddr = await owner.getAddress()
    anotherAccount = accounts[8]
    anotherAccountAddr = await anotherAccount.getAddress()
    recipient = accounts[9]
    recipientAddr = await recipient.getAddress()

    const Chainport = await hre.ethers.getContractFactory("ChainportToken");
    chainportToken = await Chainport.deploy(
        config['local'].tokenName,
        config['local'].tokenSymbol,
        toChainportDenomination(config['local'].totalSupply.toString()),
        ownerAddr
    );
    await chainportToken.deployed()
    chainportToken = chainportToken.connect(owner)
}

describe('ChainportToken:ERC20', () => {
    before('setup ChainportToken contract', async () => {
        await setupContractAndAccounts()
    })

    describe('totalSupply', () => {
        it('returns the total amount of tokens', async () => {
            (await chainportToken.totalSupply()).should.equal(INITIAL_SUPPLY)
        })
    })

    describe('balanceOf', () => {
        describe('when the requested account has no tokens', () => {
            it('returns zero', async () => {
                (await chainportToken.balanceOf(anotherAccountAddr)).should.equal(0)
            })
        })

        describe('when the requested account has some tokens', () => {
            it('returns the total amount of tokens', async () => {
                (await chainportToken.balanceOf(ownerAddr)).should.equal(INITIAL_SUPPLY)
            })
        })
    })
})

describe('ChainportToken:ERC20:transfer', () => {
    before('setup ChainportToken contract', async () => {
        await setupContractAndAccounts()
    })

    describe('when the sender does NOT have enough balance', () => {
        it('reverts', async () => {
            expect(
                await isEthException(chainportToken.transfer(recipientAddr, overdraftAmount))
            ).to.be.true
        })
    })

    describe('when the sender has enough balance', () => {
        before(async () => {
            r = await awaitTx(chainportToken.transfer(recipientAddr, transferAmount))
        })

        it('should transfer the requested amount', async () => {
            const senderBalance = await chainportToken.balanceOf(ownerAddr)
            const recipientBalance = await chainportToken.balanceOf(recipientAddr)
            const supply = await chainportToken.totalSupply()
            supply.sub(transferAmount).should.equal(senderBalance)
            recipientBalance.should.equal(transferAmount)
        })
        it('should emit a transfer event', async () => {
            expect(r.events.length).to.equal(1)
            expect(r.events[0].event).to.equal('Transfer')
            expect(r.events[0].args.from).to.equal(ownerAddr)
            expect(r.events[0].args.to).to.equal(recipientAddr)
            r.events[0].args.value.should.equal(transferAmount)
        })
    })

    describe('when the recipient is the zero address', () => {
        it('should fail', async () => {
            expect(
                await isEthException(chainportToken.transfer(ZERO_ADDRESS, transferAmount))
            ).to.be.true
        })
    })
})

describe('ChainportToken:ERC20:transferFrom', () => {
    before('setup ChainportToken contract', async () => {
        await setupContractAndAccounts()
    })

    describe('when the spender does NOT have enough approved balance', () => {
        describe('when the owner does NOT have enough balance', () => {
            it('reverts', async () => {
                await awaitTx(chainportToken.approve(anotherAccountAddr, overdraftAmountMinusOne))
                expect(
                    await isEthException(chainportToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, overdraftAmount))
                ).to.be.true
            })
        })

        describe('when the owner has enough balance', () => {
            it('reverts', async () => {
                await awaitTx(chainportToken.approve(anotherAccountAddr, transferAmountMinusOne))
                expect(
                    await isEthException(chainportToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, transferAmount))
                ).to.be.true
            })
        })
    })

    describe('when the spender has enough approved balance', () => {
        describe('when the owner does NOT have enough balance', () => {
            it('should fail', async () => {
                await awaitTx(chainportToken.approve(anotherAccountAddr, overdraftAmount))
                expect(
                    await isEthException(chainportToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, overdraftAmount))
                ).to.be.true
            })
        })

        describe('when the owner has enough balance', () => {
            let prevSenderBalance, r

            before(async () => {
                prevSenderBalance = await chainportToken.balanceOf(ownerAddr)
                await chainportToken.approve(anotherAccountAddr, transferAmount)
                r = await (await chainportToken.connect(anotherAccount).transferFrom(ownerAddr, recipientAddr, transferAmount)).wait()
            });


            it('emits a transfer event', async () => {
                expect(r.events.length).to.be.equal(2);
                expect(r.events[0].event).to.equal('Transfer')
                expect(r.events[0].args.from).to.equal(ownerAddr)
                expect(r.events[0].args.to).to.equal(recipientAddr)
                r.events[0].args.value.should.equal(transferAmount)
            });

            it('transfers the requested amount', async () => {
                const senderBalance = await chainportToken.balanceOf(ownerAddr)
                const recipientBalance = await chainportToken.balanceOf(recipientAddr)
                prevSenderBalance.sub(transferAmount).should.equal(senderBalance)
                recipientBalance.should.equal(transferAmount)
            })

            it('decreases the spender allowance', async () => {
                expect((await chainportToken.allowance(ownerAddr, anotherAccountAddr)).eq(0)).to.be.true
            })

        })
    })
})

describe('ChainportToken:ERC20:approve', () => {
    before('setup ChainportToken contract', async () => {
        await setupContractAndAccounts()
    })

    describe('when the spender is NOT the zero address', () => {
        describe('when the sender has enough balance', () => {
            describe('when there was no approved amount before', () => {
                before(async () => {
                    await awaitTx(chainportToken.approve(anotherAccountAddr, 0))
                    r = await awaitTx(chainportToken.approve(anotherAccountAddr, transferAmount))
                })

                it('approves the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmount)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(transferAmount)
                })
            })

            describe('when the spender had an approved amount', () => {
                before(async () => {
                    await awaitTx(chainportToken.approve(anotherAccountAddr, toChainportDenomination(1)))
                    r = await awaitTx(chainportToken.approve(anotherAccountAddr, transferAmount))
                })

                it('approves the requested amount and replaces the previous one', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmount)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(transferAmount)
                })
            })
        })

        describe('when the sender does not have enough balance', () => {
            describe('when there was no approved amount before', () => {
                before(async () => {
                    await chainportToken.approve(anotherAccountAddr, 0)
                    r = await (await chainportToken.approve(anotherAccountAddr, overdraftAmount)).wait()
                })

                it('approves the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmount)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(overdraftAmount)
                })
            })

            describe('when the spender had an approved amount', () => {
                before(async () => {
                    await chainportToken.approve(anotherAccountAddr, toChainportDenomination(1))
                    r = await (await chainportToken.approve(anotherAccountAddr, overdraftAmount)).wait()
                })

                it('approves the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmount)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(overdraftAmount)
                })
            })
        })
    })
})

describe('ChainportToken:ERC20:increaseAllowance', () => {
    before('setup ChainportToken contract', async () => {
        await setupContractAndAccounts()
    })

    describe('when the spender is NOT the zero address', () => {
        describe('when the sender has enough balance', () => {
            describe('when there was no approved amount before', () => {
                before(async () => {
                    await chainportToken.approve(anotherAccountAddr, 0)
                    r = await (await chainportToken.increaseAllowance(anotherAccountAddr, transferAmount)).wait()
                })
                it('approves the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmount)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(transferAmount)
                })
            })

            describe('when the spender had an approved amount', () => {
                beforeEach(async () => {
                    await chainportToken.approve(anotherAccountAddr, unitTokenAmount)
                    r = await (await chainportToken.increaseAllowance(anotherAccountAddr, transferAmount)).wait()
                })

                it('increases the spender allowance adding the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(transferAmountPlusOne)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(transferAmountPlusOne)
                })
            })
        })

        describe('when the sender does not have enough balance', () => {
            describe('when there was no approved amount before', () => {
                before(async () => {
                    await chainportToken.approve(anotherAccountAddr, 0)
                    r = await (await chainportToken.increaseAllowance(anotherAccountAddr, overdraftAmount)).wait()
                })

                it('approves the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmount)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(overdraftAmount)
                })
            })

            describe('when the spender had an approved amount', () => {
                beforeEach(async () => {
                    await chainportToken.approve(anotherAccountAddr, unitTokenAmount)
                    r = await (await chainportToken.increaseAllowance(anotherAccountAddr, overdraftAmount)).wait()
                })

                it('increases the spender allowance adding the requested amount', async () => {
                    (await chainportToken.allowance(ownerAddr, anotherAccountAddr)).should.equal(overdraftAmountPlusOne)
                })

                it('emits an approval event', async () => {
                    expect(r.events.length).to.equal(1)
                    expect(r.events[0].event).to.equal('Approval')
                    expect(r.events[0].args.owner).to.equal(ownerAddr)
                    expect(r.events[0].args.spender).to.equal(anotherAccountAddr)
                    r.events[0].args.value.should.equal(overdraftAmountPlusOne)
                })
            })
        })
    })
});
