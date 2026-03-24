// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract HelpGrowToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event DiscountRedeemed(address indexed user, uint256 amount);
    event TemplateUnlocked(address indexed user, uint256 templateId, uint256 amount);

    constructor(address minter) ERC20("Help & Grow", "HG") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, minter);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    /// @notice Burn tokens to receive a booking discount. 100 tokens = 1 SGD.
    function redeemDiscount(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        _burn(msg.sender, amount);
        emit DiscountRedeemed(msg.sender, amount);
    }

    /// @notice Burn tokens to unlock a premium template.
    function redeemTemplate(uint256 templateId, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        _burn(msg.sender, amount);
        emit TemplateUnlocked(msg.sender, templateId, amount);
    }
}
