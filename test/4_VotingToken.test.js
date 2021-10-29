const { BN, constants, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { MAX_UINT256, ZERO_ADDRESS } = constants;

const Wallet = require('ethereumjs-wallet').default;

const VotingTokenMock = artifacts.require('VotingTokenMock');

const EIP712 = require('./helper/EIP712');

contract('BEP20Votes', function (accounts) {
    const [ holder, recipient, holderDelegatee, recipientDelegatee, other1, other2, other3, delegator ] = accounts;
    const name = 'Laqira Token';
    const symbol = 'LQR';
    const supply = new BN('10000000000000000000000000');

    let chainId;
    beforeEach(async function () {
        this.token = await VotingTokenMock.new(name, symbol);
        
        
        // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
        // from within the EVM as from the JSON RPC interface.
        // See https://github.com/trufflesuite/ganache-core/issues/515
        chainId = await this.token._getChainId();
    });

    describe('metadata', function () {
        it('has given name', async function () {
            expect(await this.token.name()).to.be.equal(name);
        });
        
        it('has given symbol', async function () {
            expect(await this.token.symbol()).to.be.equal(symbol);
        });
    });

    it('initial nonce is 0', async function () {
        expect(await this.token.nonces(holder)).to.be.bignumber.equal('0');
    });

    it('minting restriction', async function () {
        const amount = new BN('2').pow(new BN('96'));
        await expectRevert(
            this.token.mint(holder, amount),
            'BEP20Votes: total supply risks overflowing votes',
        );
    });

    describe('set delegation', function () {
        describe('call', function () {
            it('delegation with balance', async function () {
                await this.token.mint(holder, supply);
                expect(await this.token.delegates(holder)).to.be.equal(ZERO_ADDRESS);

                const { receipt } = await this.token.delegate(holder, { from: holder });
                expectEvent(receipt, 'DelegateeChanged', {
                    delegator: holder,
                    fromDelegate: ZERO_ADDRESS,
                    toDelegate: holder,
                });
                expectEvent(receipt, 'DelegateVotesChanged', {
                    delegate: holder,
                    previousBalance: '0',
                    newBalance: supply,
                });

                expect(await this.token.delegates(holder)).to.be.equal(holder);
                expect(await this.token.getVotes(holder)).to.be.bignumber.equal(supply);
                expect(await this.token.getPastVotes(holder, receipt.blockNumber - 1)).to.be.bignumber.equal('0');
                await time.advanceBlock();
                expect(await this.token.getPastVotes(holder, receipt.blockNumber)).to.be.bignumber.equal(supply);
            });
        });

        it('delegation without balance', async function () {
            expect(await this.token.delegates(holder)).to.be.equal(ZERO_ADDRESS);

            const { receipt } = await this.token.delegate(holder, { from: holder });
            expectEvent(receipt, 'DelegateeChanged', {
                delegator: holder,
                fromDelegate: ZERO_ADDRESS,
                toDelegate: holder,
            });
            expectEvent.notEmitted(receipt, 'DelegateVotesChanged');

            expect(await this.token.delegates(holder)).to.be.equal(holder);
        });

        it('voting power calculation', async function () {
            await this.token.mint(holder, supply);

            await this.token.transfer(recipient, 1000, {from: holder});

            expect(await this.token.delegates(recipient)).to.equal(ZERO_ADDRESS);

            await this.token.delegate(recipient, {from: recipient});
            expect(await this.token.numCheckpoints(recipient)).to.be.bignumber.equal('1');
            expect(await this.token.getVotes(recipient)).to.be.bignumber.equal('1000');
            
            await this.token.delegate(other1, {from: recipient});
            expect(await this.token.numCheckpoints(recipient)).to.be.bignumber.equal('2');
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('1');


            expect(await this.token.getVotes(recipient)).to.be.bignumber.equal('0');
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('1000');
            expect(await this.token.delegates(recipient)).to.be.bignumber.equal(other1);

            await this.token.transfer(other2, 2000, {from: holder});
            await this.token.delegate(other1, {from: other2});
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('2');
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('3000');

            await this.token.transfer(recipient, 1000, {from: holder});
            expect(await this.token.balanceOf(recipient)).to.be.bignumber.equal('2000');

            await this.token.delegate(other1, {from: recipient});
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('2');
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('3000');

            await this.token.resetDelegate({from: recipient});
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('3');
            expect(await this.token.delegates(recipient)).to.be.bignumber.equal(ZERO_ADDRESS);
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('2000');

            await this.token.delegate(other1, {from: recipient});
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('4');
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('4000');

            await this.token.transfer(other3, 100, {from: recipient});
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('3900');
            expect(await this.token.getVotes(other3)).to.be.bignumber.equal('0');
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('5');

            await this.token.resetDelegate({from: other2});
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('6');
            expect(await this.token.getVotes(other1)).to.be.bignumber.equal('1900');
        });
    });

    describe('delegateBySig', function () {
        const delegator = Wallet.generate();
        const delegatorAddress = web3.utils.toChecksumAddress(delegator.getAddressString());
        const nonce = 0;
        const expiry = MAX_UINT256;

        beforeEach(async function () {
            await this.token.mint(delegatorAddress, supply);
        });

        const Domain = (LQR) => ({name, chainId, verifyingContract: LQR.address});
        const Message = (address) => ({delegatee: address, nonce, expiry});

        const Types = {
            Delegation: [
              { name: 'delegatee', type: 'address' },
              { name: 'nonce', type: 'uint256' },
              { name: 'expiry', type: 'uint256' }
            ]
        };

        it('accept signed delegation', async function () {
            const {v, r, s} = EIP712.sign(Domain(this.token), 'Delegation', Message(delegatorAddress), Types, delegator.getPrivateKey());
            
            expect(await this.token.delegates(delegatorAddress)).to.be.equal(ZERO_ADDRESS);

            const { receipt } = await this.token.delegateBySig(delegatorAddress, nonce, expiry, v, r, s);

            expectEvent(receipt, 'DelegateeChanged', {
                delegator: delegatorAddress,
                fromDelegate: ZERO_ADDRESS,
                toDelegate: delegatorAddress,
            });

            expectEvent(receipt, 'DelegateVotesChanged', {
                delegate: delegatorAddress,
                previousBalance: '0',
                newBalance: supply,
            });

            expect(await this.token.delegates(delegatorAddress)).to.be.equal(delegatorAddress);
            expect(await this.token.getVotes(delegatorAddress)).to.be.bignumber.equal(supply);
            expect(await this.token.getPastVotes(delegatorAddress, receipt.blockNumber - 1)).to.be.bignumber.equal('0');
    
            await time.advanceBlock();
            expect(await this.token.getPastVotes(delegatorAddress, receipt.blockNumber)).to.be.bignumber.equal(supply);    
        });

        it('rejects reused signature', async function () {
            const {v, r, s} = EIP712.sign(Domain(this.token), 'Delegation', Message(delegatorAddress), Types, delegator.getPrivateKey());
    
            await this.token.delegateBySig(delegatorAddress, nonce, expiry, v, r, s);
    
            await expectRevert(
                this.token.delegateBySig(delegatorAddress, nonce, expiry, v, r, s),
                'LQR::delegateBySig: invalid nonce',
            );
        });

        it('rejects bad delegatee', async function () {
            const {v, r, s} = EIP712.sign(Domain(this.token), 'Delegation', Message(delegatorAddress), Types, delegator.getPrivateKey());
            
            const { logs } = await this.token.delegateBySig(holderDelegatee, nonce, expiry, v, r, s);
            const { args } = logs.find(({ event }) => event == 'DelegateeChanged');
            expect(args.delegator).to.not.be.equal(delegatorAddress);
            expect(args.fromDelegate).to.be.equal(ZERO_ADDRESS);
            expect(args.toDelegate).to.be.equal(holderDelegatee);
        });

        it('rejects bad nonce', async function () {
            const {v, r, s} = EIP712.sign(Domain(this.token), 'Delegation', Message(delegatorAddress), Types, delegator.getPrivateKey());
            await expectRevert(
              this.token.delegateBySig(delegatorAddress, nonce + 1, expiry, v, r, s),
              'LQR::delegateBySig: invalid nonce',
            );
        });
    });

    describe('change delegation', function () {
        beforeEach(async function () {
            await this.token.mint(holder, supply);
           await this.token.delegate(holder, { from: holder });
       });

       it('call', async function () {
            expect(await this.token.delegates(holder)).to.be.equal(holder);

            const { receipt } = await this.token.delegate(holderDelegatee, { from: holder });
            expectEvent(receipt, 'DelegateeChanged', {
                delegator: holder,
                fromDelegate: holder,
                toDelegate: holderDelegatee,
            });
            expectEvent(receipt, 'DelegateVotesChanged', {
                delegate: holder,
                previousBalance: supply,
                newBalance: '0',
            });
            expectEvent(receipt, 'DelegateVotesChanged', {
                delegate: holderDelegatee,
                previousBalance: '0',
                newBalance: supply,
            });

            expect(await this.token.delegates(holder)).to.be.equal(holderDelegatee);

            expect(await this.token.getVotes(holder)).to.be.bignumber.equal('0');
            expect(await this.token.getVotes(holderDelegatee)).to.be.bignumber.equal(supply);
            expect(await this.token.getPastVotes(holder, receipt.blockNumber - 1)).to.be.bignumber.equal(supply);
            expect(await this.token.getPastVotes(holderDelegatee, receipt.blockNumber - 1)).to.be.bignumber.equal('0');
            await time.advanceBlock();
            expect(await this.token.getPastVotes(holder, receipt.blockNumber)).to.be.bignumber.equal('0');
            expect(await this.token.getPastVotes(holderDelegatee, receipt.blockNumber)).to.be.bignumber.equal(supply);
        });
    });

    describe('transfers', function () {
        beforeEach(async function () {
            await this.token.mint(holder, supply);
        });
        
        it('delegation', async function () {
            await this.token.delegate(holder, {from: holder});
            const { receipt } = await this.token.transfer(recipient, 1, { from: holder });
            expectEvent(receipt, 'Transfer', { from: holder, to: recipient, value: '1' });
            expectEvent(receipt, 'DelegateVotesChanged', {
                delegate: holder,
                previousBalance: supply,
                newBalance: supply.subn(1),
            });
        });

        it('no delegation', async function () {
            await this.token.mint(other1, new BN('100'));
            expect(await this.token.delegates(other1)).to.be.equal(ZERO_ADDRESS);
            const { receipt } = await this.token.transfer(other2, 1, { from: other1 });
            expectEvent(receipt, 'Transfer', { from: other1, to: other2, value: '1' });
            expectEvent.notEmitted(receipt, 'DelegateVotesChanged');
        });
    });

    describe('numCheckpoints', function () {
        beforeEach(async function () {
            await this.token.mint(holder, supply);
        });

        describe('balanceOf', function () {
            it('grants to initial account', async function () {
              expect(await this.token.balanceOf(holder)).to.be.bignumber.equal('10000000000000000000000000');
            });
        });

        it('returns the number of checkpoints for a delegate', async function () {
            await this.token.transfer(recipient, '100', { from: holder });
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('0');

            const t1 = await this.token.delegate(other1, { from: recipient });
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('1');

            const t2 = await this.token.transfer(other2, 10, { from: recipient });
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('2');

            const t3 = await this.token.transfer(other2, 10, { from: recipient });
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('3');

            const t4 = await this.token.transfer(recipient, 20, { from: holder });
            expect(await this.token.numCheckpoints(other1)).to.be.bignumber.equal('3');

            await time.advanceBlock();
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber)).to.be.bignumber.equal('100');
            expect(await this.token.getPastVotes(other1, t2.receipt.blockNumber)).to.be.bignumber.equal('90');
            expect(await this.token.getPastVotes(other1, t3.receipt.blockNumber)).to.be.bignumber.equal('80');
            
            expect(await this.token.getPastVotes(other1, t4.receipt.blockNumber)).to.be.bignumber.equal('80');
        });
    });

    describe('getPastVotes', function () {
        beforeEach(async function () {
            await this.token.mint(holder, supply);
        });

        it('reverts if block number >= current block', async function () {
            await expectRevert(
              this.token.getPastVotes(other1, 5e10),
              'BEP20Votes: block not yet mined',
            );
        });

        it('returns 0 if there are no checkpoints', async function () {
            expect(await this.token.getPastVotes(other1, 0)).to.be.bignumber.equal('0');
        });

        it('returns the latest block if >= last checkpoint block', async function () {
            const t1 = await this.token.delegate(other1, {from: holder});
            
            await time.advanceBlock();
            await time.advanceBlock();
    
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber)).to.be.bignumber.equal('10000000000000000000000000');
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber + 1)).to.be.bignumber.equal('10000000000000000000000000');
        });

        it('returns zero if < first checkpoint block', async function () {
            await time.advanceBlock();
            const t1 = await this.token.delegate(other1, { from: holder });
            await time.advanceBlock();
            await time.advanceBlock();
    
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber - 1)).to.be.bignumber.equal('0');
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber + 1)).to.be.bignumber.equal('10000000000000000000000000');
        });

        it('generally returns the voting balance at the appropriate checkpoint', async function () {
            const t1 = await this.token.delegate(other1, { from: holder });
            await time.advanceBlock();
            await time.advanceBlock();
            const t2 = await this.token.transfer(other2, 10, { from: holder });
            await time.advanceBlock();
            await time.advanceBlock();
            const t3 = await this.token.transfer(other2, 10, { from: holder });
            await time.advanceBlock();
            await time.advanceBlock();
            const t4 = await this.token.transfer(holder, 20, { from: other2 });
            await time.advanceBlock();
            await time.advanceBlock();
    
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber - 1)).to.be.bignumber.equal('0');
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber)).to.be.bignumber.equal('10000000000000000000000000');
            expect(await this.token.getPastVotes(other1, t1.receipt.blockNumber + 1)).to.be.bignumber.equal('10000000000000000000000000');
            
            expect(await this.token.getPastVotes(other1, t2.receipt.blockNumber)).to.be.bignumber.equal('9999999999999999999999990');
            expect(await this.token.getPastVotes(other1, t2.receipt.blockNumber + 1)).to.be.bignumber.equal('9999999999999999999999990');
            
            expect(await this.token.getPastVotes(other1, t3.receipt.blockNumber)).to.be.bignumber.equal('9999999999999999999999980');
            expect(await this.token.getPastVotes(other1, t3.receipt.blockNumber + 1)).to.be.bignumber.equal('9999999999999999999999980');
            
            expect(await this.token.getPastVotes(other1, t4.receipt.blockNumber)).to.be.bignumber.equal('9999999999999999999999980');
            expect(await this.token.getPastVotes(other1, t4.receipt.blockNumber + 1)).to.be.bignumber.equal('9999999999999999999999980');
        });
    });

    describe('getPastTotalSupply', function () {
        beforeEach(async function () {
            await this.token.delegate(holder, { from: holder });
        });

        it('reverts if block number >= current block', async function () {
            await expectRevert(
              this.token.getPastTotalSupply(5e10),
              'BEP20Votes: block not yet mined',
            );
        });

        it('returns 0 if there are no checkpoints', async function () {
            expect(await this.token.getPastTotalSupply(0)).to.be.bignumber.equal('0');
        });

        it('returns the latest block if >= last checkpoint block', async function () {
            t1 = await this.token.mint(holder, supply);
      
            await time.advanceBlock();
            await time.advanceBlock();
      
            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber)).to.be.bignumber.equal(supply);
            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber + 1)).to.be.bignumber.equal(supply);
        });

        it('returns zero if < first checkpoint block', async function () {
            await time.advanceBlock();
            const t1 = await this.token.mint(holder, supply);
            await time.advanceBlock();
            await time.advanceBlock();
      
            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber - 1)).to.be.bignumber.equal('0');
            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber + 1)).to.be.bignumber.equal('10000000000000000000000000');
        });

        it('generally returns the voting balance at the appropriate checkpoint', async function () {
            const t1 = await this.token.mint(holder, supply);
            await time.advanceBlock();
            await time.advanceBlock();
            const t2 = await this.token.burn(holder, 10);
            await time.advanceBlock();
            await time.advanceBlock();
            const t3 = await this.token.burn(holder, 10);
            await time.advanceBlock();
            await time.advanceBlock();
            const t4 = await this.token.mint(holder, 20);
            await time.advanceBlock();
            await time.advanceBlock();

            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber - 1)).to.be.bignumber.equal('0');
            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber)).to.be.bignumber.equal('10000000000000000000000000');
            expect(await this.token.getPastTotalSupply(t1.receipt.blockNumber + 1)).to.be.bignumber.equal('10000000000000000000000000');
            expect(await this.token.getPastTotalSupply(t2.receipt.blockNumber)).to.be.bignumber.equal('9999999999999999999999990');
            expect(await this.token.getPastTotalSupply(t2.receipt.blockNumber + 1)).to.be.bignumber.equal('9999999999999999999999990');
            expect(await this.token.getPastTotalSupply(t3.receipt.blockNumber)).to.be.bignumber.equal('9999999999999999999999980');
            expect(await this.token.getPastTotalSupply(t3.receipt.blockNumber + 1)).to.be.bignumber.equal('9999999999999999999999980');
            expect(await this.token.getPastTotalSupply(t4.receipt.blockNumber)).to.be.bignumber.equal('10000000000000000000000000');
            expect(await this.token.getPastTotalSupply(t4.receipt.blockNumber + 1)).to.be.bignumber.equal('10000000000000000000000000');
        });
    });
});