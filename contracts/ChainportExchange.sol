//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "./interfaces/UniswapV2Interface.sol";
import "./ChainportMiddleware.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ChainportExchange is ChainportMiddleware{

	address private router;
	address private stableCoin;
	uint8 private stableCoinDecimals;

	constructor (
		address _router,
		address _stableCoin,
		address maintainersRegistry,
		address chainportCongress
	) public {
		router = _router;
		stableCoin = _stableCoin;
		stableCoinDecimals = ERC20(stableCoin).decimals();
		setCongressAndMaintainers(chainportCongress, maintainersRegistry);
	}

	function getTokenValueInUsd(uint amount, address token) external view returns(uint [] memory amounts) {
		require(stableCoin != address(0), "Error: StableCoin not set.");
		address [] memory pair;
		pair[0] = token;
		pair[1] = stableCoin;
		require(router != address(0), "Error: Router not set.");
		return UniswapV2Interface(router).getAmountsOut(amount, pair);
	}

	function setStableCoin(address _stableCoin) external onlyChainportCongress {
		require(_stableCoin != address(0), "Error: Address is malformed.");
		stableCoin = _stableCoin;
		stableCoinDecimals = ERC20(stableCoin).decimals();
	}

	function changeRouter(address _router) external onlyChainportCongress {
		router = _router;
	}
}
