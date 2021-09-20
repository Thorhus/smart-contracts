//"SPDX-License-Identifier: UNLICENSED"
pragma solidity ^0.6.12;

import "./interfaces/UniswapV2Interface.sol";
import "./ChainportMiddleware.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ChainportExchange is ChainportMiddleware{

	address private router;
	address private stableCoin;
	uint8 private stableCoinDecimals;

	//TODO:in the initial request, if there's a quote, extract from it the USD value per token (price of a single token, and save to mapping token->price)
	//TODO:add another mapping of token->lastSampledAt + token->lastSampledAtAmount
	//TODO:in subsequeny requests, get random threshold of time raffled between [minBlocks,maxBlocks] from previous block sampled for the token, if current block is greater, resample
	//TODO:in subsequent requests, if current amount is greater then 1.MinAmountRatioDiffThreshold (e.g. MinAmountRatioDiffThreshold=5), resample
	//TODO:else, take existing sampled rate and calculate amount worth.


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

	//TODO: gas cost = ???
	//TODO: avg gas cost BSC --> projected price per call in USD BSC = ?
	//TODO: avg gas cost POLYGON --> projected price per call in USD Polygon = ?
	function getTokenValueInUsd(uint amount, address token) external view returns(uint [] memory amounts) {
		require(stableCoin != address(0), "Error: StableCoin not set.");
		address [] memory pair = new address[](2);
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
