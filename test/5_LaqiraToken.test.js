const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { unspecified } = require('@openzeppelin/test-helpers/src/expectRevert');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

const LaqiraToken = artifacts.require('LaqiraToken');
const NotBEP677Compatible = artifacts.require("NotBEP677Compatible");
const Token677ReceiverMock = artifacts.require("Token677ReceiverMock");
const LQRReceiver = artifacts.require("LQRReceiver");

contract('LaqiraToken', (accounts) => {
    const [owner, sender, anotherAccount] = accounts;

    let token, recipient;
    let totalSupply = new BN('1000000000000');

    beforeEach(async () => {
        token = await LaqiraToken.new(totalSupply, {from: owner});
    });

    it('assigns all of the balance to the owner', async function () {
        expect(await token.balanceOf(owner)).to.be.bignumber.equal(totalSupply);
    });

    describe('#transfer(address,uint256)', () => {
        let transferAmount, receiver;
        
        beforeEach(async () => {
            receiver = await Token677ReceiverMock.new({from: owner});

            transferAmount = new BN('100');
            await token.transfer(sender, transferAmount, {from: owner});
        });

        describe('frost function', function () {
            const frostedAmount = new BN('50');
            it('cannot transfer frosted amount', async function () {
                const receipt = await token.frost(sender, frostedAmount, {from: owner});

                expectEvent(receipt, 'Frost', {
                    from: owner,
                    to: sender,
                    value: frostedAmount
                });

                let balance = await token.balanceOf(sender);
                expect(balance).to.be.bignumber.equal(transferAmount.add(frostedAmount));

                let availableBalance = await token.availableBalance(sender);
                expect(availableBalance).to.be.bignumber.equal(transferAmount);

                let frosted = await token.frostedOf(sender);

                expect(frosted).to.be.bignumber.equal(frostedAmount);

                await expectRevert(token.transfer(anotherAccount, availableBalance.addn(1), {from: sender}),
                'LQR: not avaiable balance');
            });

            it('transfer tokens after triggered defrost function', async function () {
                const value = new BN('10');
                await token.frost(sender, frostedAmount, {from: owner});
                
                const frostedOf = await token.frostedOf(sender);
                expect(frostedOf).to.be.bignumber.equal(frostedAmount);

                const preAvailableBalance = await token.availableBalance(sender);
                expect(preAvailableBalance).to.be.bignumber.equal(transferAmount);
                
                const receipt = await token.defrost(sender, value, {from: owner});

                expectEvent(receipt, 'Defrost', {
                    from: owner,
                    to: sender,
                    value: value
                });

                expect(await token.frostedOf(sender)).to.be.bignumber.equal(frostedOf.sub(value));
                
                const postAvailableBalance = await token.availableBalance(sender);
                expect(postAvailableBalance).to.be.bignumber.equal(preAvailableBalance.add(value));
            });

            it('prevents non-owners from freezing', async function () {
                await expectRevert(token.frost(sender, frostedAmount, { from: anotherAccount }),
                'Ownable: caller is not the owner',);
            });
        });

        describe('pausable token', function () {
            it('allows to transfer when paused and then unpaused', async function () {
                await token.pause();
                await token.unpause();

                await token.transfer(receiver.address, transferAmount, { from: sender });

                expect(await token.balanceOf(sender)).to.be.bignumber.equal('0');
                expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal(transferAmount);
            });

            it('reverts when trying to transfer when paused', async function () {
                await token.pause();
        
                await expectRevert(token.transfer(receiver.address, transferAmount, { from: sender }),
                  'BEP20Pausable: token transfer while paused',
                );
            });

            it('prevents non-owners from pausing', async function () {
                await expectRevert(token.pause({ from: anotherAccount }),
                'Ownable: caller is not the owner',);
            });
        });

        it('does not let you transfer to the null address', async function () {
            await expectRevert(token.transfer(ZERO_ADDRESS, transferAmount, {from: sender}),
            'BEP20: transfer to the zero address');
        });

        it('does not let you transfer to the contract itself', async () => {
            await expectRevert(token.transfer(token.address, transferAmount), 
            'LQR: recipient cannot be Laqira token address');
        });

        it('transfers the tokens', async function () {
            expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal('0');
            await token.transfer(receiver.address, transferAmount, {from: sender});
    
            expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal(transferAmount)
        });

        it('does NOT call the fallback on transfer', async function () {
            await token.transfer(receiver.address, transferAmount, {from: sender});
    
            expect(await receiver.calledFallback()).to.be.false
        });

        it('transfer succeeds with response', async function () {
            const response = await token.transfer(receiver.address, transferAmount);
            expect(response).to.exist;
        });

        it('throws when the transfer fails', async function () {
            await expectRevert(token.transfer(receiver.address, 1000, {from: sender}),
            'LQR: not avaiable balance');
        });

        describe('when sending to a contract that is not BEP677 compatible', function () {
            let nonBEP677;

            beforeEach(async function () {
                nonBEP677 = await NotBEP677Compatible.new({from: owner});
            });

            it('transfers the token', async function () {
                expect(await token.balanceOf(nonBEP677.address)).to.be.bignumber.equal('0');
               
                await token.transfer(nonBEP677.address, transferAmount, {from: sender})
      
                expect(await token.balanceOf(nonBEP677.address)).to.be.bignumber.equal(transferAmount);
            });
        });

        describe('#transfer(address,uint256,bytes)', () => {
            const value = new BN('10');
            const data = '0x043e94bd';
            beforeEach(async () => {
                recipient = await LQRReceiver.new({owner});
            });

            it('allows to transfer and call when unpaused', async function () {
                // 0x043e94bd callbackWithoutWithdrawl()
                const { logs } = await token.transferAndCall(recipient.address, value, data,
                {from: owner});
                
                expectEvent.inLogs(logs, 'Transfer', {
                    from: owner,
                    to: recipient.address,
                    value: value,
                    data: data
                });

                expect(await token.balanceOf(recipient.address)).to.be.bignumber.equal(value);

                expect(await recipient.fallbackCalled()).to.be.true;
                expect(await recipient.callDataCalled()).to.be.true;
            });

            it('reverts when trying to transfer and call when paused', async function () {
                await token.pause();

                await expectRevert(token.transferAndCall(recipient.address, value, data, {from: owner}),
                'BEP20Pausable: token transfer while paused');
            });

            it('does not blow up if no data is passed', async function () {
                await token.transferAndCall(recipient.address, value, "0x", {from: owner});

                expect(await recipient.fallbackCalled()).to.be.true;
                expect(await recipient.callDataCalled()).to.be.false;
            });
        });
    });

    describe('transfer from', function () {
        const allowance = new BN('40');
        const value = new BN('100');

        beforeEach(async function () {
            await token.transfer(sender, value, {from: owner});
            await token.approve(anotherAccount, allowance, { from: sender });
        });

        it('allows to transfer from when unpaused', async function () {
            await token.transferFrom(sender, anotherAccount, allowance, { from: anotherAccount });
            expect(await token.balanceOf(anotherAccount)).to.be.bignumber.equal(allowance);
            expect(await token.balanceOf(sender)).to.be.bignumber.equal(value.sub(allowance));
        });

        it('allows to transfer when paused and then unpaused', async function () {
            await token.pause();
            await token.unpause();
    
            await token.transferFrom(sender, anotherAccount, allowance, { from: anotherAccount });
    
            expect(await token.balanceOf(anotherAccount)).to.be.bignumber.equal(allowance);
            expect(await token.balanceOf(sender)).to.be.bignumber.equal(value.sub(allowance));
        });

        it('reverts when trying to transfer from when paused', async function () {
            await token.pause();
    
            await expectRevert(token.transferFrom(
              sender, anotherAccount, allowance, { from: anotherAccount }), 'BEP20Pausable: token transfer while paused',
            );
        });

        it('throws an error when transferring to the null address', async function () {
            await expectRevert(token.transferFrom(sender, ZERO_ADDRESS, allowance, {from: anotherAccount}),
            "BEP20: transfer to the zero address");
        });

        it('throws an error when transferring to the token itself', async function () {
            await unspecified(token.transferFrom(sender, token.address, allowance, {from: anotherAccount}));
        });
    });

    describe('#approve', function ()  {
        const amount = 1000;

        it('allows token approval amounts to be updated without first resetting to zero', async function () {
            const originalApproval = new BN('1000');
            await token.approve(anotherAccount, originalApproval, {from: owner});
            let approvedAmount = await token.allowance(owner, anotherAccount);
            expect(approvedAmount).to.be.bignumber.equal(originalApproval)
    
            const laterApproval = new BN('2000');
            await token.approve(anotherAccount, laterApproval, {from: owner});
            approvedAmount = await token.allowance(owner, anotherAccount);
            expect(approvedAmount).to.be.bignumber.equal(laterApproval)
        });

        it('throws an error when approving the null address', async function () {
            await expectRevert(token.approve(ZERO_ADDRESS, amount, {from: owner}),
            'BEP20: approve to the zero address');
        });
    });

    describe('mint', function () {
        const amount = new BN(50);
        it('rejects a null account', async function () {
            await expectRevert(token.mint(ZERO_ADDRESS, amount), 
            'BEP20: mint to the zero address');
        });

        describe('for a non zero account', function () {
            beforeEach('minting', async function () {
                const { logs } = await token.mint(anotherAccount, amount, {from: owner});
                this.logs = logs;
            });
            
            it('increments totalSupply', async function () {
                const expectedSupply = totalSupply.add(amount);
                expect(await token.totalSupply()).to.be.bignumber.equal(expectedSupply);
            });

            it('increments recipient balance', async function () {
                expect(await token.balanceOf(anotherAccount)).to.be.bignumber.equal(amount);
            });

            it('emits Transfer event', async function () {
                const event = expectEvent.inLogs(this.logs, 'Transfer', {
                  from: ZERO_ADDRESS,
                  to: anotherAccount
                });
                expect(event.args.value).to.be.bignumber.equal(amount);
            });

            it('prevents non-owners from minting', async function () {
                await expectRevert(token.mint(anotherAccount, amount, { from: anotherAccount }),
                'Ownable: caller is not the owner',);
            });

            it('minting restriction', async function () {
                const amount = new BN('10').pow(new BN('28'));
                await expectRevert(token.mint(anotherAccount, amount),
                'BEP20Votes: total supply risks overflowing votes',);
            });
        });
    });

    describe('burn', function () {
        const amount = new BN('10');
        describe('for a non zero account', function () {
            it('rejects burning more than balance', async function () {
                await expectRevert(token.burn(
                totalSupply.addn(1)), 'BEP20: burn amount exceeds balance',
                );
            });

            beforeEach('burning', async function () {
                const { logs } = await token.burn(amount, {from: owner});
                this.logs = logs;
            });

            it('decrements totalSupply', async function () {
                const expectedSupply = totalSupply.sub(amount);
                expect(await token.totalSupply()).to.be.bignumber.equal(expectedSupply);
            });

            it('decrements holder balance', async function () {
                const expectedBalance = totalSupply.sub(amount);
                expect(await token.balanceOf(owner)).to.be.bignumber.equal(expectedBalance);
            });

            it('emits Transfer event', async function () {
                const event = expectEvent.inLogs(this.logs, 'Transfer', {
                  from: owner,
                  to: ZERO_ADDRESS,
                });
    
                expect(event.args.value).to.be.bignumber.equal(amount);
            });
        });
    });

});