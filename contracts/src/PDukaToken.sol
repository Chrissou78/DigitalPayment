// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract PDukaToken is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 public constant MAX_SUPPLY = 21_000_000_000 * 10 ** 18; // 21B

    constructor(address treasury) ERC20("PayDuka", "PDUKA") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Mint entire supply to treasury at genesis
        _mint(treasury, MAX_SUPPLY);
    }

    // Override to enforce max supply (redundant since all minted at genesis, but safety)
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override {
        super._update(from, to, value);
    }
}
