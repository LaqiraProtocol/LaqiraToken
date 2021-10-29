const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { unspecified } = require('@openzeppelin/test-helpers/src/expectRevert');
const { expect } = require('chai');

const Token677ReceiverMock = artifacts.require("Token677ReceiverMock");
const NotBEP677Compatible = artifacts.require("NotBEP677Compatible");
const SmartTokenMock = artifacts.require("SmartTokenMock");

contract('SmartTokenMock', (accounts) => {
    let [ sender ] = accounts;
    let receiverContract, smartToken, data;

    const supply = new BN('1000000');
    let transferAmount = '100';
    data = '0x90e91d8ab3579d46650a';
    
    beforeEach(async () => {
        receiverContract = await Token677ReceiverMock.new();
        smartToken = await SmartTokenMock.new(supply);
    });

    it('transfer', async function () {
        await smartToken.transfer(receiverContract.address, transferAmount);
        expect(await receiverContract.sentValue()).to.be.bignumber.equal('0');
    });

    describe("#transferAndCall(address, uint, bytes)", () => {
        it('should transfer the tokens', async () => {
            expect(await smartToken.balanceOf(receiverContract.address)).to.be.bignumber.equal('0');
        });

        it('should call the token fallback function on transfer', async () => {
            await smartToken.transferAndCall(receiverContract.address, new BN(transferAmount), data, {from: sender});

            expect(await receiverContract.calledFallback()).to.be.true; 
            expect(await receiverContract.tokenSender()).to.be.equal(sender);
            expect(await receiverContract.sentValue()).to.be.bignumber.equal(transferAmount);
        });

        it('throws when the transfer fails', async () => {
            await expectRevert(smartToken.transferAndCall(receiverContract.address, supply.addn(1), data),
            'BEP20: transfer amount exceeds balance'); 
        });

        describe('when sending to a contract that is not BEP677 compatible', () => {
            let nonBEP677;

            beforeEach(async () => {
                nonBEP677 = await NotBEP677Compatible.new();
            });

            it('throws an error', async () => {
                await unspecified(smartToken.transferAndCall(nonBEP677.address, supply, data));
                
                expect(await smartToken.balanceOf(nonBEP677.address)).to.be.bignumber.equal('0');
            });
        });
    });
});