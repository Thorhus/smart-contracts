pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract ChainportBridgeEth{

    mapping(address => uint) public balancesByAddresses;

    event TokensUnfreezed(address tokenAddress, address issuer, uint amount);
    event TokensFreezed(address tokenAddress, address issuer, uint amount);


    function freezeToken(address token, uint256 amount) public payable{
        IERC20 ercToken = IERC20(token);

        ercToken.transferFrom(address(msg.sender), address(this), amount);

        balancesByAddresses[address(ercToken)] = balancesByAddresses[address(ercToken)] + amount;

        emit TokensFreezed(token, msg.sender, amount);
    }

    function releaseTokens(address token, address receiver, uint amount) public {
        require(balancesByAddresses[address(token)] >= amount);

        IERC20 ercToken = IERC20(token);
        ercToken.transfer(address(receiver), amount);
        balancesByAddresses[address(token)] = balancesByAddresses[address(token)] - amount;
        emit TokensUnfreezed(token, msg.sender, amount);
    }
}
