// SPDX-License-Identifier: bsl-1.1

pragma solidity ^0.8.9;

interface IOracleRegistry {
    function setOracleTypeForAsset ( address asset, uint256 oracleType ) external;
}

interface IParametersBatchUpdater {
    function setCollaterals(
        address[] calldata assets,
        uint stabilityFeeValue,
        uint liquidationFeeValue,
        uint initialCollateralRatioValue,
        uint liquidationRatioValue,
        uint liquidationDiscountValue,
        uint devaluationPeriodValue,
        uint usdpLimit,
        uint[] calldata oracles
    ) external;
}

interface ICDPManager01 {
    function join(address asset, uint assetAmount, uint usdpAmount) external;
    function exit(address asset, uint assetAmount, uint usdpAmount) external;
}

interface IWrappedToUnderlyingOracle {
    function setUnderlying(address wrapped, address underlying) external;
    function assetToUsd(address asset, uint amount) external view returns (uint);
}

interface IVeDistribution {
    function checkpoint_token() external;
    function checkpoint_total_supply() external;
}