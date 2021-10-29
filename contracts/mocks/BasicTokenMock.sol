// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../BasicToken.sol";


contract BasicTokenMock is BasicToken {
    constructor(
        address initialAccount,
        uint256 totalSupply,
        uint8 decimals
    ) {
        _balances[initialAccount] = totalSupply;
        _totalSupply = totalSupply;
        _decimals = decimals;
    }

    function transferInternal(
        address from,
        address to,
        uint256 value
    ) public {
        _transfer(from, to, value);
    }
}