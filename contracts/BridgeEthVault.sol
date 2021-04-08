pragma solidity ^0.6.12;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';


contract BridgeEthVault {
    function transferTokens(address token, address receiver, uint amount) onlyBridge {
        IERC20(token).transferTokens(receiver, amount);
    }
}
