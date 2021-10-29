// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


import "../StandardToken.sol";


contract StandardTokenMock is StandardToken {
    constructor(address initialAccount, uint initialBalance) {
        _balances[initialAccount] = initialBalance;
        _totalSupply = initialBalance;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}