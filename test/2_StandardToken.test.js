const { expectRevert } = require('@openzeppelin/test-helpers');
const { expect, assert } = require('chai');

const StandardTokenMock = artifacts.require('StandardTokenMock');

contract('StandardToken', (accounts) => {
    const [defaultAddress, person1, person2, person3] = accounts;

    let token;

    beforeEach(async () => {
        token = await StandardTokenMock.new(defaultAddress, 100);
    })

    it('should return the correct allowance amount after approval', async () => {
        await token.approve(person2, 100, {from: person1});
        expect(await token.allowance(person1, person2)).to.be.bignumber.equal('100');     
    });

    it('should return correct balances after transferring from another account', async () => {
        await token.approve(person2, 100, {from: defaultAddress});

        await token.transferFrom(defaultAddress, person3, 100, {from: person2});

        expect(await token.balanceOf(defaultAddress)).to.be.bignumber.equal('0');

        expect(await token.balanceOf(person3)).to.be.bignumber.equal('100');

        expect(await token.balanceOf(person2)).to.be.bignumber.equal('0');
    });

    it('should throw an error when trying to transfer more than allowed', async () => {
        await token.approve(person1, 99, {from: defaultAddress});

        await expectRevert(token.transferFrom(defaultAddress, person3, 100, {from: person1}),
        'BEP20: transfer amount exceeds allowance');
    });

    describe('validating allowance updates to spender', () => {
        it('should start with zero', async () => {
          const preApproved = await token.allowance(defaultAddress, person1);
          assert.equal(preApproved, 0);
        });
  
        it('should increase by 50 then decrease by 10', async () => {
          const preApproved = await token.allowance(defaultAddress, person1);
  
          await token.increaseAllowance(person1, 50, {from: defaultAddress});
          const postIncrease = await token.allowance(defaultAddress, person1);
          expect(preApproved.addn(50)).to.be.bignumber.equal(postIncrease);
  
          await token.decreaseAllowance(person1, 10, {from: defaultAddress});
          const postDecrease = await token.allowance(defaultAddress, person1);
          expect(postIncrease.subn(10)).to.be.bignumber.equal(postDecrease);
        });
    });
});