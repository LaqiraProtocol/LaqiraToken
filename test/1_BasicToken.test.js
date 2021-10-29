const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { ZERO_ADDRESS } = constants;

const BasicTokenMock = artifacts.require('BasicTokenMock');

contract('BasicToken', function (accounts) {
    const [initialHolder, recipient] = accounts;

    const totalSupply = new BN('100');
    const decimals = "18";
 
    beforeEach(async function () {
        this.token = await BasicTokenMock.new(initialHolder, totalSupply, decimals);
    });

    it('has 18 decimals', async function () {
        expect(await this.token.decimals()).to.be.bignumber.equal(decimals);
    });

    it('should return the correct totalSupply after construction', async function () {
       expect(await this.token.totalSupply()).to.be.bignumber.equal(totalSupply);
    });

    describe('_transfer', function () {
        describe('when the sender is the zero address', function () {
            it('reverts', async function () {
                await expectRevert(this.token.transferInternal(ZERO_ADDRESS, recipient, totalSupply),
                'BEP20: transfer from the zero address');
            });

            it('when the sender does not have enough balance', async function () {
                const amount = totalSupply.addn(1);
                await expectRevert(this.token.transferInternal(initialHolder, recipient, amount),
                'BEP20: transfer amount exceeds balance');             
            });

            it('throws when the transfer fails', async function () {
                await expectRevert(this.token.transferInternal(initialHolder, recipient, totalSupply.addn(1)),
                "BEP20: transfer amount exceeds balance");
            });

            it('transfers the requested amount', async function () {
                await this.token.transferInternal(initialHolder, recipient, '100');
                
                expect(await this.token.balanceOf(initialHolder)).to.be.bignumber.equal('0');

                expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal('100');
            });

            it('emits a transfer event', async function () {
                const receipt = await this.token.transferInternal(initialHolder, recipient, '100');
                expectEvent(receipt, 'Transfer', {
                    from: initialHolder,
                    to: recipient,
                    value: '100'
                });
            });
        });
    });
});