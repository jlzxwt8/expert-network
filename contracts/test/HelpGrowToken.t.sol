// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/HelpGrowToken.sol";

contract HelpGrowTokenTest is Test {
    HelpGrowToken token;
    address minter = address(1);
    address user = address(2);

    function setUp() public {
        token = new HelpGrowToken(minter);
    }

    function testMint() public {
        vm.prank(minter);
        token.mint(user, 100);
        assertEq(token.balanceOf(user), 100);
    }

    function testDecimals() public view {
        assertEq(token.decimals(), 0);
    }

    function testOnlyMinterCanMint() public {
        vm.prank(user);
        vm.expectRevert();
        token.mint(user, 50);
    }

    function testRedeemDiscount() public {
        vm.prank(minter);
        token.mint(user, 200);

        vm.prank(user);
        token.redeemDiscount(100);

        assertEq(token.balanceOf(user), 100);
    }

    function testRedeemDiscountInsufficientBalance() public {
        vm.prank(minter);
        token.mint(user, 50);

        vm.prank(user);
        vm.expectRevert();
        token.redeemDiscount(100);
    }

    function testRedeemTemplate() public {
        vm.prank(minter);
        token.mint(user, 500);

        vm.prank(user);
        token.redeemTemplate(42, 200);

        assertEq(token.balanceOf(user), 300);
    }

    function testRedeemZeroReverts() public {
        vm.prank(user);
        vm.expectRevert("Amount must be > 0");
        token.redeemDiscount(0);
    }
}
