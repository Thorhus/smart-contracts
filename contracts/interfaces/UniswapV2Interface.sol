pragma solidity ^0.6.12;

interface UniswapV2Interface {
		function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts);
}
