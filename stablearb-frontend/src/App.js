import React, { useState, useEffect } from "react";
import {
  Activity,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  BarChart3,
  Settings,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Zap,
  Globe,
  DollarSign,
  Shield,
} from "lucide-react";

// API Base URL - Fixed for Replit environment
const getApiBase = () => {
  const currentUrl = window.location.href;
  console.log("Current frontend URL:", currentUrl);

  // For Replit environment
  if (window.location.hostname.includes("replit.dev")) {
    // Your frontend is on port 4200, backend should be on 3001
    const baseUrl =
      window.location.protocol +
      "//" +
      window.location.hostname.replace(":4200", ":3001");
    console.log("Replit backend URL:", baseUrl + "/api");
    return baseUrl + "/api";
  }

  // For local development
  if (window.location.hostname === "localhost") {
    return "http://localhost:3001/api";
  }

  // Fallback
  return "/api";
};

const API_BASE = getApiBase();

// Debug logging - check console to see these values
console.log("=== API Configuration ===");
console.log("Frontend URL:", window.location.href);
console.log("Backend API URL:", API_BASE);
console.log("========================");

const StableArbBridge = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [walletStatus, setWalletStatus] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tradingEnabled, setTradingEnabled] = useState(false);

  // Fetch wallet status
  const fetchWalletStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/swap/wallet-status`);
      const data = await response.json();
      if (data.success) {
        setWalletStatus(data.data);
        setTradingEnabled(data.data.trading.enabled);
      } else {
        setError(data.error || "Failed to fetch wallet status");
      }
    } catch (err) {
      setError("Failed to fetch wallet status: " + err.message);
    }
  };

  // Fetch arbitrage opportunities
  const fetchOpportunities = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/swap/scan-opportunities?includeCelo=true&includeTriangular=true`,
      );
      const data = await response.json();
      if (data.success) {
        setOpportunities(data.data.opportunities || []);
        setError(null); // Clear any previous errors
      } else {
        setError(data.error || "Failed to fetch opportunities");
      }
    } catch (err) {
      setError("Failed to fetch opportunities: " + err.message);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      await Promise.all([fetchWalletStatus(), fetchOpportunities()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Auto-refresh opportunities every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchOpportunities, 30000);
    return () => clearInterval(interval);
  }, []);

  // Execute arbitrage trade
  const executeTrade = async (opportunity, dryRun = true) => {
    try {
      const tradeData = {
        tokenPair: opportunity.pair,
        amount: opportunity.recommendedAmount || 50,
        direction: opportunity.direction,
        expectedSpread: opportunity.spread,
        maxSlippage: 1.0,
        dryRun,
        confirmRealMoney: !dryRun,
      };

      const response = await fetch(`${API_BASE}/swap/execute-arbitrage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeData),
      });

      const result = await response.json();

      if (result.success) {
        alert(
          `${dryRun ? "Simulation" : "Trade"} completed successfully! Profit: ${result.data.summary?.actualProfit}%`,
        );
        // Refresh opportunities after trade
        fetchOpportunities();
      } else {
        alert(`${dryRun ? "Simulation" : "Trade"} failed: ${result.error}`);
      }
    } catch (err) {
      alert("Trade execution failed: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Loading StableArb Bridge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Zap className="w-8 h-8 text-blue-500 mr-3" />
              <h1 className="text-xl font-bold">StableArb Bridge v2</h1>
              <span className="ml-3 px-2 py-1 bg-green-600 text-xs rounded-full">
                Enhanced
              </span>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${walletStatus?.portfolio?.readyForTrading ? "bg-green-500" : "bg-yellow-500"}`}
                ></div>
                <span className="text-sm">
                  {walletStatus?.portfolio?.readyForTrading
                    ? "Ready"
                    : "Setup Required"}
                </span>
              </div>
              <button
                onClick={() => {
                  fetchWalletStatus();
                  fetchOpportunities();
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: "dashboard", name: "Dashboard", icon: BarChart3 },
              { id: "opportunities", name: "Opportunities", icon: TrendingUp },
              { id: "wallets", name: "Wallets", icon: Wallet },
              { id: "trading", name: "Trading", icon: ArrowRightLeft },
              { id: "settings", name: "Settings", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-gray-400 hover:text-gray-300"
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-600 border border-red-500 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              {error}
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-200 hover:text-white"
            >
              ×
            </button>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Portfolio Overview */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Portfolio</h3>
                  <DollarSign className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-green-400 mb-2">
                  ${walletStatus?.portfolio?.totalValueUSD || "0.00"}
                </div>
                <div className="text-sm text-gray-400">
                  Across{" "}
                  {Object.keys(walletStatus?.portfolio?.breakdown || {}).length}{" "}
                  chains
                </div>
              </div>

              {/* Active Opportunities */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Opportunities</h3>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-blue-400 mb-2">
                  {opportunities.length}
                </div>
                <div className="text-sm text-gray-400">
                  {opportunities.filter((o) => o.confidence === "HIGH").length}{" "}
                  high confidence
                </div>
              </div>

              {/* Best Spread */}
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Best Spread</h3>
                  <TrendingUp className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-purple-400 mb-2">
                  {opportunities.length > 0
                    ? `${Math.max(...opportunities.map((o) => o.spread)).toFixed(2)}%`
                    : "0.00%"}
                </div>
                <div className="text-sm text-gray-400">
                  {opportunities.length > 0
                    ? opportunities[0]?.pair
                    : "No opportunities"}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={fetchOpportunities}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-3 rounded-lg flex items-center justify-center transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                  />
                  Scan Opportunities
                </button>
                <button
                  onClick={() => setActiveTab("wallets")}
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-3 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Check Wallets
                </button>
                <button
                  onClick={() => setActiveTab("trading")}
                  className="bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg flex items-center justify-center transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4 mr-2" />
                  Execute Trade
                </button>
                <button
                  onClick={() => setActiveTab("opportunities")}
                  className="bg-orange-600 hover:bg-orange-700 px-4 py-3 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Activity className="w-4 h-4 mr-2" />
                  View All
                </button>
              </div>
            </div>

            {/* Recent Opportunities */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Top Opportunities</h3>
              {opportunities.slice(0, 5).map((opp, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-3 border-b border-gray-700 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">{opp.pair}</div>
                    <div className="text-sm text-gray-400">
                      {opp.chains?.join(" → ") || opp.direction} •{" "}
                      {opp.confidence} confidence
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-bold ${opp.spread > 1 ? "text-green-400" : "text-yellow-400"}`}
                    >
                      {opp.spread}%
                    </div>
                    <div className="text-sm text-gray-400">
                      ~$
                      {(
                        (opp.recommendedAmount || 50) *
                        opp.spread *
                        0.007
                      ).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
              {opportunities.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No opportunities found. Click "Scan Opportunities" to refresh.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Opportunities Tab */}
        {activeTab === "opportunities" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Arbitrage Opportunities</h2>
              <button
                onClick={fetchOpportunities}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded-lg flex items-center"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            <div className="grid gap-4">
              {opportunities.map((opp, index) => (
                <div
                  key={index}
                  className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{opp.pair}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>{opp.type || "Cross-chain"}</span>
                        <span>•</span>
                        <span>{opp.chains?.join(" → ") || opp.direction}</span>
                        <span>•</span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            opp.confidence === "HIGH"
                              ? "bg-green-600"
                              : opp.confidence === "MEDIUM"
                                ? "bg-yellow-600"
                                : "bg-red-600"
                          }`}
                        >
                          {opp.confidence}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-2xl font-bold ${
                          opp.spread > 1.5
                            ? "text-green-400"
                            : opp.spread > 0.8
                              ? "text-yellow-400"
                              : "text-orange-400"
                        }`}
                      >
                        {opp.spread}%
                      </div>
                      <div className="text-sm text-gray-400">Spread</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">
                        Recommended Amount
                      </div>
                      <div className="font-medium">
                        ${opp.recommendedAmount || 50}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Est. Profit</div>
                      <div className="font-medium text-green-400">
                        {opp.estimatedProfit}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Est. Gas</div>
                      <div className="font-medium">
                        {opp.estimatedGasCost?.total || "~$3-5"}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">Risk</div>
                      <div
                        className={`font-medium ${
                          opp.riskLevel === "LOW"
                            ? "text-green-400"
                            : opp.riskLevel === "MEDIUM"
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {opp.riskLevel || "MEDIUM"}
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => executeTrade(opp, true)}
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center transition-colors"
                    >
                      <Activity className="w-4 h-4 mr-2" />
                      Simulate
                    </button>
                    {tradingEnabled && (
                      <button
                        onClick={() => {
                          if (
                            window.confirm(
                              "Execute real trade? This will use actual tokens and gas.",
                            )
                          ) {
                            executeTrade(opp, false);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg flex items-center transition-colors"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Execute
                      </button>
                    )}
                  </div>

                  {opp.specialFeatures && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="text-sm text-gray-400">
                        Special Features:
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {opp.specialFeatures.map((feature, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-gray-700 rounded-full text-xs"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {opportunities.length === 0 && (
                <div className="bg-gray-800 rounded-lg p-12 text-center">
                  <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Opportunities Found
                  </h3>
                  <p className="text-gray-400 mb-4">
                    No profitable arbitrage opportunities detected at current
                    market prices.
                  </p>
                  <button
                    onClick={fetchOpportunities}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded-lg"
                  >
                    Refresh Scan
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wallets Tab */}
        {activeTab === "wallets" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Wallet Status</h2>

            <div className="grid gap-6">
              {["ethereum", "sui", "celo"].map((chain) => {
                const wallet = walletStatus?.wallets?.[chain];
                const chainName =
                  chain.charAt(0).toUpperCase() + chain.slice(1);

                return (
                  <div
                    key={chain}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <Globe className="w-6 h-6 mr-3 text-blue-500" />
                        <h3 className="text-lg font-semibold">{chainName}</h3>
                        {wallet?.connected ? (
                          <CheckCircle className="w-5 h-5 ml-2 text-green-500" />
                        ) : (
                          <AlertCircle className="w-5 h-5 ml-2 text-red-500" />
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm ${
                          wallet?.connected ? "bg-green-600" : "bg-red-600"
                        }`}
                      >
                        {wallet?.connected ? "Connected" : "Not Connected"}
                      </span>
                    </div>

                    {wallet?.connected && (
                      <>
                        <div className="mb-4">
                          <div className="text-sm text-gray-400">Address</div>
                          <div className="font-mono text-sm break-all">
                            {wallet.address}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(wallet.balances || {}).map(
                            ([token, balance]) => {
                              if (token === "address" || token === "network")
                                return null;

                              return (
                                <div
                                  key={token}
                                  className="text-center p-3 bg-gray-700 rounded-lg"
                                >
                                  <div className="text-sm text-gray-400">
                                    {token}
                                  </div>
                                  <div className="font-semibold">
                                    {typeof balance === "number"
                                      ? balance.toFixed(4)
                                      : balance}
                                  </div>
                                </div>
                              );
                            },
                          )}
                        </div>

                        <div className="mt-4 text-sm text-gray-400">
                          Network: {wallet.balances?.network}
                        </div>
                      </>
                    )}

                    {!wallet?.connected && (
                      <div className="text-gray-400">
                        <p className="mb-2">Wallet not connected.</p>
                        <p className="text-sm">
                          Configure your {chainName.toUpperCase()}
                          _TEST_PRIVATE_KEY in the .env file.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Portfolio Summary */}
            {walletStatus?.portfolio && (
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">
                  Portfolio Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      ${walletStatus.portfolio.totalValueUSD}
                    </div>
                    <div className="text-sm text-gray-400">Total Value</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {
                        Object.keys(walletStatus.portfolio.breakdown || {})
                          .length
                      }
                    </div>
                    <div className="text-sm text-gray-400">Active Chains</div>
                  </div>
                  <div className="text-center">
                    <div
                      className={`text-2xl font-bold ${
                        walletStatus.portfolio.readyForTrading
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {walletStatus.portfolio.readyForTrading
                        ? "Ready"
                        : "Setup"}
                    </div>
                    <div className="text-sm text-gray-400">Trading Status</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {walletStatus.portfolio.crossChainCapable ? "Yes" : "No"}
                    </div>
                    <div className="text-sm text-gray-400">Cross-Chain</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trading Tab */}
        {activeTab === "trading" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Execute Trades</h2>

            <div className="bg-yellow-600 border border-yellow-500 rounded-lg p-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span>
                This is testnet trading only. No real money is at risk.
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best Opportunities */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Best Opportunities
                </h3>

                {opportunities.slice(0, 3).map((opp, index) => (
                  <div
                    key={index}
                    className="p-4 bg-gray-700 rounded-lg mb-4 last:mb-0"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{opp.pair}</h4>
                      <span
                        className={`text-lg font-bold ${
                          opp.spread > 1 ? "text-green-400" : "text-yellow-400"
                        }`}
                      >
                        {opp.spread}%
                      </span>
                    </div>

                    <div className="text-sm text-gray-400 mb-3">
                      {opp.chains?.join(" → ") || opp.direction} •{" "}
                      {opp.confidence} confidence
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => executeTrade(opp, true)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded text-sm transition-colors"
                      >
                        Simulate
                      </button>
                      {tradingEnabled && (
                        <button
                          onClick={() => {
                            if (window.confirm("Execute real trade?"))
                              executeTrade(opp, false);
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 px-3 py-2 rounded text-sm transition-colors"
                        >
                          Execute
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {opportunities.length === 0 && (
                  <div className="text-center text-gray-400 py-8">
                    No opportunities available
                  </div>
                )}
              </div>

              {/* Trading Configuration */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Trading Settings</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Trading Mode
                    </label>
                    <div
                      className={`p-3 rounded-lg ${
                        tradingEnabled ? "bg-green-600" : "bg-gray-700"
                      }`}
                    >
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 mr-2" />
                        {tradingEnabled
                          ? "Real Trading Enabled"
                          : "Simulation Mode Only"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Safety Limits
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700 p-3 rounded-lg">
                        <div className="text-sm text-gray-400">Max Trade</div>
                        <div className="font-medium">
                          $
                          {walletStatus?.trading?.safetyLimits?.maxTradeUSD ||
                            100}
                        </div>
                      </div>
                      <div className="bg-gray-700 p-3 rounded-lg">
                        <div className="text-sm text-gray-400">Min Profit</div>
                        <div className="font-medium">
                          {walletStatus?.trading?.safetyLimits
                            ?.minProfitPercent || 0.3}
                          %
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-2">
                      Supported Chains
                    </label>
                    <div className="flex space-x-2">
                      {["Ethereum", "Sui", "Celo"].map((chain) => (
                        <span
                          key={chain}
                          className="px-3 py-1 bg-blue-600 rounded-full text-sm"
                        >
                          {chain}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Settings</h2>

            <div className="grid gap-6">
              {/* System Status */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">System Status</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div
                      className={`text-2xl font-bold ${
                        walletStatus?.trading?.enabled
                          ? "text-green-400"
                          : "text-gray-400"
                      }`}
                    >
                      {walletStatus?.trading?.enabled ? "ON" : "OFF"}
                    </div>
                    <div className="text-sm text-gray-400">Real Trading</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {walletStatus?.trading?.testnetMode ? "YES" : "NO"}
                    </div>
                    <div className="text-sm text-gray-400">Testnet Mode</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      v2.0
                    </div>
                    <div className="text-sm text-gray-400">Version</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {opportunities.length}
                    </div>
                    <div className="text-sm text-gray-400">Active Scans</div>
                  </div>
                </div>
              </div>

              {/* API Endpoints */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">API Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-700">
                    <span className="text-sm">Health Check</span>
                    <code className="bg-gray-700 px-2 py-1 rounded text-xs">
                      GET /api/health
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-700">
                    <span className="text-sm">Scan Opportunities</span>
                    <code className="bg-gray-700 px-2 py-1 rounded text-xs">
                      GET /api/swap/scan-opportunities
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-gray-700">
                    <span className="text-sm">Execute Trade</span>
                    <code className="bg-gray-700 px-2 py-1 rounded text-xs">
                      POST /api/swap/execute-arbitrage
                    </code>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm">Wallet Status</span>
                    <code className="bg-gray-700 px-2 py-1 rounded text-xs">
                      GET /api/swap/wallet-status
                    </code>
                  </div>
                </div>
              </div>

              {/* Enhanced Features */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Enhanced Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    "Multi-chain arbitrage (3 chains)",
                    "Triangular arbitrage support",
                    "Celo native stablecoin trading",
                    "Enhanced risk assessment",
                    "Real-time opportunity scanning",
                    "Atomic swap capabilities",
                    "Gas optimization routing",
                    "Advanced safety limits",
                  ].map((feature, index) => (
                    <div
                      key={index}
                      className="flex items-center p-3 bg-gray-700 rounded-lg"
                    >
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              StableArb Bridge v2.0 - Cross-chain arbitrage trading system
            </p>
            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <span>Testnet Only</span>
              <span>•</span>
              <span>No Real Money at Risk</span>
              <span>•</span>
              <span className="flex items-center">
                <Shield className="w-4 h-4 mr-1" />
                Safe Trading
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default StableArbBridge;
