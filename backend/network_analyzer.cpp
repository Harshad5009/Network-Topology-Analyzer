#include <iostream>
#include <vector>
#include <queue>
#include <map>
#include <set>
#include <limits>
#include <algorithm>
#include <string>
#include <tuple> 

#include "json.hpp" 

using json = nlohmann::json;
using namespace std;

const int INF = numeric_limits<int>::max();
const long long INF_LL = 1e18; // Stronger INF for long long distances

// --- Data Structures ---

struct Edge {
    int to;
    int weight; 
    int bandwidth;
    bool active;
};

struct Node {
    int id;
    string name;
    string type;
};

struct BSTNode {
    int destId;
    int nextHop;
    int totalCost;
    int parentId;
    BSTNode* left;
    BSTNode* right;

    BSTNode(int d, int nh, int c, int p) : destId(d), nextHop(nh), totalCost(c), parentId(p), left(nullptr), right(nullptr) {}
};

class RoutingTable {
public:
    BSTNode* root;

    RoutingTable() : root(nullptr) {}

    BSTNode* insert(BSTNode* node, int dest, int nextHop, int cost, int parent) {
        if (!node) return new BSTNode(dest, nextHop, cost, parent);
        if (dest < node->destId)
            node->left = insert(node->left, dest, nextHop, cost, parent);
        else if (dest > node->destId)
            node->right = insert(node->right, dest, nextHop, cost, parent);
        return node;
    }

    void addRoute(int dest, int nextHop, int cost, int parent) {
        root = insert(root, dest, nextHop, cost, parent);
    }

    void toJSON(BSTNode* node, json& j) {
        if (!node) return;
        toJSON(node->left, j);
        j.push_back({{"destination", node->destId}, {"next_hop", node->nextHop}, {"cost", node->totalCost}, {"parent", node->parentId}});
        toJSON(node->right, j);
    }
};

class NetworkGraph {
    int V;
    map<int, vector<Edge>> adj;
    map<int, Node> nodes;

public:
    NetworkGraph() : V(0) {}

    void addNode(int id, string name, string type) {
        nodes[id] = {id, name, type};
        if (id >= V) V = id + 1;
    }

    void addEdge(int u, int v, int w, int bw, bool active = true) {
        adj[u].push_back({v, w, bw, active});
        adj[v].push_back({u, w, bw, active});
    }

    // --- Dijkstra ---
    pair<map<int, long long>, map<int, int>> dijkstra(int src) {
        map<int, long long> dist;
        map<int, int> parent;
        
        for (auto const& p : nodes) dist[p.first] = INF_LL;
        for (auto const& p : adj) {
            if (dist.find(p.first) == dist.end()) dist[p.first] = INF_LL;
            for (auto const& e : p.second) if (dist.find(e.to) == dist.end()) dist[e.to] = INF_LL;
        }

        if (dist.find(src) == dist.end()) return {dist, parent};

        priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<pair<long long, int>>> pq;

        dist[src] = 0;
        parent[src] = -1;
        pq.push({0, src});

        while (!pq.empty()) {
            int u = pq.top().second;
            long long d = pq.top().first;
            pq.pop();

            if (d > dist[u]) continue;

            for (auto& edge : adj[u]) {
                if (edge.active && dist[u] != INF_LL && dist[u] + edge.weight < dist[edge.to]) {
                    dist[edge.to] = dist[u] + edge.weight;
                    parent[edge.to] = u;
                    pq.push({dist[edge.to], edge.to});
                }
            }
        }
        return {dist, parent};
    }

    // --- Bellman-Ford ---
    pair<map<int, long long>, map<int, int>> bellmanFord(int src) {
        map<int, long long> dist;
        map<int, int> parent;
        set<int> allNodes;

        for (auto const& p : nodes) allNodes.insert(p.first);
        for (auto const& p : adj) {
            allNodes.insert(p.first);
            for (auto const& e : p.second) allNodes.insert(e.to);
        }

        for (int node : allNodes) dist[node] = INF_LL;
        if (allNodes.find(src) == allNodes.end()) return {dist, parent};

        dist[src] = 0;
        parent[src] = -1;

        int numV = allNodes.size();
        for (int i = 0; i < numV - 1; ++i) {
            bool changed = false;
            for (auto const& nodeEntry : adj) {
                int u = nodeEntry.first;
                if (dist[u] == INF_LL) continue;
                for (auto const& edge : nodeEntry.second) {
                    if (edge.active && dist[u] + edge.weight < dist[edge.to]) {
                        dist[edge.to] = dist[u] + edge.weight;
                        parent[edge.to] = u;
                        changed = true;
                    }
                }
            }
            if (!changed) break;
        }
        return {dist, parent};
    }

    // --- Cycle Detection ---
    bool hasCycleUtil(int v, map<int, bool>& visited, int parent) {
        visited[v] = true;
        for (auto& edge : adj[v]) {
            if (!edge.active) continue;
            int neighbor = edge.to;
            if (!visited[neighbor]) {
                if (hasCycleUtil(neighbor, visited, v)) return true;
            } else if (neighbor != parent) {
                return true;
            }
        }
        return false;
    }

    bool hasCycle() {
        map<int, bool> visited;
        for (auto const& p : nodes) {
            int id = p.first;
            if (!visited[id]) {
                if (hasCycleUtil(id, visited, -1)) return true;
            }
        }
        return false;
    }

    // --- MST (Prim's) Algorithm ---
    vector<tuple<int, int, int>> getMST() {
        vector<tuple<int, int, int>> mstEdges;
        if (nodes.empty()) return mstEdges;

        int startNode = nodes.begin()->first;
        map<int, int> key, parent;
        map<int, bool> inMST;

        for (auto const& p : nodes) {
            key[p.first] = INF;
            inMST[p.first] = false;
        }

        key[startNode] = 0;
        parent[startNode] = -1;
        priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;
        pq.push({0, startNode});

        while (!pq.empty()) {
            int u = pq.top().second;
            pq.pop();

            if (inMST[u]) continue;
            inMST[u] = true;

            if (parent[u] != -1) {
                mstEdges.push_back(make_tuple(parent[u], u, key[u]));
            }

            for (auto& edge : adj[u]) {
                if (edge.active && !inMST[edge.to] && edge.weight < key[edge.to]) {
                    key[edge.to] = edge.weight;
                    parent[edge.to] = u;
                    pq.push({key[edge.to], edge.to});
                }
            }
        }
        return mstEdges;
    }

    // --- Reliability Analysis (Bridges & Articulation Points) ---
    void findReliability(json& output) {
        map<int, int> disc, low, parent;
        map<int, bool> isAP;
        vector<pair<int, int>> bridges;
        int timer = 0;

        for (auto const& p : nodes) {
            disc[p.first] = -1;
            isAP[p.first] = false;
        }

        for (auto const& p : nodes) {
            if (disc[p.first] == -1) {
                dfsReliability(p.first, timer, disc, low, parent, isAP, bridges);
            }
        }

        json apArray = json::array();
        for (auto const& p : isAP) if (p.second) apArray.push_back(p.first);
        
        json bridgeArray = json::array();
        for (auto& b : bridges) bridgeArray.push_back({{"from", b.first}, {"to", b.second}});

        output["articulation_points"] = apArray;
        output["bridges"] = bridgeArray;
    }

    void dfsReliability(int u, int& timer, map<int, int>& disc, map<int, int>& low, 
                        map<int, int>& parent, map<int, bool>& isAP, vector<pair<int, int>>& bridges) {
        int children = 0;
        disc[u] = low[u] = ++timer;

        for (auto& edge : adj[u]) {
            int v = edge.to;
            if (v == parent[u]) continue;

            if (disc[v] != -1) {
                low[u] = min(low[u], disc[v]);
            } else {
                children++;
                parent[v] = u;
                dfsReliability(v, timer, disc, low, parent, isAP, bridges);
                low[u] = min(low[u], low[v]);

                if (parent[u] != 0 && low[v] >= disc[u]) isAP[u] = true;
                if (low[v] > disc[u]) bridges.push_back({u, v});
            }
        }
        if (parent[u] == 0 && children > 1) isAP[u] = true;
    }
};

int main() {
    string inputStr, line;
    while (getline(cin, line)) inputStr += line;
    if (inputStr.empty()) return 0;

    try {
        json input = json::parse(inputStr);
        NetworkGraph graph;

        for (auto& n : input["nodes"]) {
            graph.addNode(n["id"], n["label"], n.value("type", "Router"));
        }
        for (auto& e : input["links"]) {
            graph.addEdge(e["source"], e["target"], e["cost"], e.value("bandwidth", 100), e.value("active", true));
        }

        json output;
        string command = input["command"];

        if (command == "route") {
            if (!input.contains("source") || input["source"].is_null() || !input.contains("target") || input["target"].is_null()) {
                throw runtime_error("Source and Target IDs are required for routing.");
            }
            int src = input["source"], dest = input["target"];
            string algo = input.value("algorithm", "dijkstra");
            
            pair<map<int, long long>, map<int, int>> result;
            if (algo == "bellman-ford") {
                result = graph.bellmanFord(src);
            } else {
                result = graph.dijkstra(src);
            }
            
            map<int, long long> dist = result.first;
            map<int, int> parent = result.second;

            vector<int> path;
            if (dist.count(dest) && dist[dest] != INF_LL) {
                int curr = dest;
                set<int> visited; // Safety against cycles in parent map
                while (curr != -1 && visited.find(curr) == visited.end()) {
                    path.push_back(curr);
                    visited.insert(curr);
                    if (parent.find(curr) == parent.end()) break;
                    curr = parent[curr];
                }
                reverse(path.begin(), path.end());
            }

            output["path"] = path;
            output["total_cost"] = (dist.count(dest) && dist[dest] != INF_LL) ? dist[dest] : -1;
            
            RoutingTable rt;
            for(auto const& pair : dist) {
                if (pair.first == src || pair.second == INF_LL) continue;
                int curr = pair.first;
                int original_parent = parent[curr];
                if (parent.find(curr) != parent.end()) {
                    set<int> visited;
                    while(parent[curr] != src && parent[curr] != -1 && visited.find(curr) == visited.end()) {
                        visited.insert(curr);
                        curr = parent[curr];
                    }
                    rt.addRoute(pair.first, curr, pair.second, original_parent);
                }
            }
            json rtJson = json::array();
            rt.toJSON(rt.root, rtJson);
            output["routing_table"] = rtJson;

        } else if (command == "analyze") {
            output["has_cycle"] = graph.hasCycle();
            
            // MST Analysis
            auto mst = graph.getMST();
            json mstJson = json::array();
            for(auto& t : mst) mstJson.push_back({{"u", get<0>(t)}, {"v", get<1>(t)}, {"w", get<2>(t)}});
            output["mst"] = mstJson;

            // Reliability Analysis
            graph.findReliability(output);
        }

        cout << output.dump() << endl;
    } catch (exception& e) {
        cout << json({{"error", e.what()}}).dump() << endl;
    }
    return 0;
}
