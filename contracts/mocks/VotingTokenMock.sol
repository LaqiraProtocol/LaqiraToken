// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../VotingToken.sol";


contract VotingTokenMock is VotingToken {
    constructor(string memory name, string memory symbol) {
        _name = name;
        _symbol = symbol;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function _getChainId() external view returns (uint256) {
        return block.chainid;
    }
}