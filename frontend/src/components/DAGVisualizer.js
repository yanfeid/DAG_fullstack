import React, { useState, useEffect } from "react";
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import "./DAGVisualizer.css";
import jsyaml from "js-yaml";

const API_URL = "http://localhost:8000";

const DAGVisualizer = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  // 控制新增节点/边面板的显示
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);

  // 新增节点的表单数据，inputs/outputs 默认以 JSON 文本形式输入
  const [newNodeData, setNewNodeData] = useState({
    id: "",
    location: "",
    inputs: "{}",
    outputs: "{}",
  });

  // 新增边的表单数据，attributes 默认以 JSON 文本形式输入，type 默认 "data_dependency"
  const [newEdgeData, setNewEdgeData] = useState({
    from: "",
    to: "",
    type: "data_dependency",
    attributes: "{}",
  });

  const [history, setHistory] = useState([]); // 记录历史状态，用于 Undo
  // 编辑已有节点/边时的表单数据
  const [formData, setFormData] = useState({
    id: "",
    label: "",
    type: "",
    location: "",
    from: "",
    to: "",
    inputs: {},
    outputs: {},
    attributes: {},
  });

  // 加载后端已修改的 DAG 数据，并转换为 React Flow 格式
  useEffect(() => {
    fetch(`${API_URL}/get-dag`)
      .then((res) => res.json())
      .then((data) => {
        setNodes(
          data.nodes.map((n, index) => ({
            id: n.id,
            data: {
              label: n.id,
              type: "default",
              location: n.location,
              inputs: n.inputs,
              outputs: n.outputs,
            },
            position: { x: index * 250, y: (index % 2) * 200 },
          }))
        );
        setEdges(
          data.edges.map((e) => ({
            id: `e${e.from}-${e.to}`,
            source: e.from,
            target: e.to,
            markerEnd: { type: "arrowclosed" },
            data: { type: e.type, attributes: e.attributes },
          }))
        );
      })
      .catch((err) => console.error("获取 DAG 失败:", err));
  }, []);

  // 将当前 nodes 与 edges 转换为 YAML 格式，并同步到后端（verified_yaml 文件）
  const syncYaml = (nodesState, edgesState) => {
    const convertedNodes = nodesState.map((node) => ({
      id: node.id,
      location: node.data.location,
      inputs: node.data.inputs,
      outputs: node.data.outputs,
    }));
    const convertedEdges = edgesState.map((edge) => ({
      from: edge.source,
      to: edge.target,
      type: edge.data.type || "data_dependency",
      attributes: edge.data.attributes,
    }));
    const dagObject = { nodes: convertedNodes, edges: convertedEdges };
    const yamlString = jsyaml.dump(dagObject);
    fetch(`${API_URL}/update-dag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dag_yaml: yamlString }),
    })
      .then((response) => response.json())
      .then((data) => console.log("YAML updated: ", data))
      .catch((err) => console.error("Failed to update YAML:", err));
  };

  // 保存当前状态到 history 中（便于 undo）
  const saveToHistory = () => {
    setHistory([...history, { nodes, edges }]);
  };

  const handleUndo = () => {
    if (history.length > 0) {
      const lastState = history[history.length - 1];
      setNodes(lastState.nodes);
      setEdges(lastState.edges);
      setHistory(history.slice(0, history.length - 1));
      syncYaml(lastState.nodes, lastState.edges);
    }
  };

  // 编辑面板输入变化（针对已有节点/边）
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleObjectChange = (type, key, value) => {
    setFormData((prev) => ({
      ...prev,
      [type]: { ...prev[type], [key]: value },
    }));
  };

  // ========== 新增节点相关 ==========
  const handleAddNodeButtonClick = () => {
    setShowAddNode(true);
    setNewNodeData({
      id: "",
      location: "",
      inputs: "{}",
      outputs: "{}",
    });
  };

  const handleNewNodeInputChange = (e) => {
    setNewNodeData({ ...newNodeData, [e.target.name]: e.target.value });
  };

  const handleAddNodeSave = () => {
    saveToHistory();

    let parsedInputs, parsedOutputs;
    try {
      parsedInputs = JSON.parse(newNodeData.inputs);
    } catch (e) {
      parsedInputs = {};
    }
    try {
      parsedOutputs = JSON.parse(newNodeData.outputs);
    } catch (e) {
      parsedOutputs = {};
    }

    const newNode = {
      id: newNodeData.id,
      data: {
        label: newNodeData.id, // 默认 UI 显示的文字与 id 相同
        location: newNodeData.location,
        inputs: parsedInputs,
        outputs: parsedOutputs,
      },
      position: { x: 100, y: 100 },
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    syncYaml(updatedNodes, edges);
    setShowAddNode(false);
  };

  // ========== 新增边相关 ==========
  const handleAddEdgeButtonClick = () => {
    setShowAddEdge(true);
    setNewEdgeData({
      from: "",
      to: "",
      type: "data_dependency",
      attributes: "{}",
    });
  };

  const handleNewEdgeInputChange = (e) => {
    setNewEdgeData({ ...newEdgeData, [e.target.name]: e.target.value });
  };

  const handleAddEdgeSave = () => {
    saveToHistory();

    let parsedAttributes;
    try {
      parsedAttributes = JSON.parse(newEdgeData.attributes);
    } catch (e) {
      parsedAttributes = {};
    }

    const newEdge = {
      id: `e${newEdgeData.from}-${newEdgeData.to}`,
      source: newEdgeData.from,
      target: newEdgeData.to,
      markerEnd: { type: "arrowclosed" },
      data: {
        type: newEdgeData.type,
        attributes: parsedAttributes,
      },
    };

    const updatedEdges = [...edges, newEdge];
    setEdges(updatedEdges);
    syncYaml(nodes, updatedEdges);
    setShowAddEdge(false);
  };

  // ========== 编辑已有节点/边 ==========
  const handleSave = () => {
    saveToHistory();
    let updatedNodes = [...nodes];
    let updatedEdges = [...edges];

    if (selectedElement) {
      if (selectedElement.source && selectedElement.target) {
        // 编辑边
        updatedEdges = updatedEdges.map((edge) => {
          if (edge.id === selectedElement.id) {
            return {
              ...edge,
              id: `e${formData.from}-${formData.to}`,
              source: formData.from,
              target: formData.to,
              data: {
                type: formData.type || "data_dependency",
                attributes: formData.attributes,
              },
            };
          }
          return edge;
        });
        setEdges(updatedEdges);
      } else {
        // 编辑节点
        const oldNodeId = selectedElement.id;
        const newNodeId = formData.id;
        // 更新引用该节点的所有边
        updatedEdges = updatedEdges.map((edge) => {
          let newEdge = { ...edge };
          if (edge.source === oldNodeId) {
            newEdge.source = newNodeId;
            newEdge.id = `e${newNodeId}-${edge.target}`;
          }
          if (edge.target === oldNodeId) {
            newEdge.target = newNodeId;
            newEdge.id = `e${edge.source}-${newNodeId}`;
          }
          return newEdge;
        });
        updatedNodes = updatedNodes.map((node) => {
          if (node.id === oldNodeId) {
            return {
              ...node,
              id: newNodeId,
              data: {
                ...node.data,
                label: newNodeId,
                type: formData.type,
                location: formData.location,
                inputs: formData.inputs,
                outputs: formData.outputs,
              },
              position: node.position,
            };
          }
          return node;
        });
        setNodes(updatedNodes);
        setEdges(updatedEdges);
      }
      syncYaml(updatedNodes, updatedEdges);
    }
    setShowEditor(false);
  };

  // 点击节点时，进入编辑模式，填充已有数据（inputs/outputs 显示为 JSON 字符串）
  const onNodeClick = (event, node) => {
    setSelectedElement(node);
    setFormData({
      id: node.id,
      label: node.data.label,
      type: node.data.type || "default",
      location: node.data.location || "",
      inputs: node.data.inputs || {},
      outputs: node.data.outputs || {},
    });
    setShowEditor(true);
  };

  // 点击边时，进入编辑模式，填充已有数据（attributes 显示为 JSON 字符串）
  const onEdgeClick = (event, edge) => {
    setSelectedElement(edge);
    setFormData({
      id: edge.id,
      from: edge.source,
      to: edge.target,
      type: edge.data.type || "data_dependency",
      label: "", // 不在边上显示 label
      attributes: edge.data.attributes || {},
    });
    setShowEditor(true);
  };

  return (
    <div className="dag-container">
      <h2 className="dag-title">DAG Verification</h2>
      <div className="add-buttons-container">
       <button className="add-node-button" onClick={handleAddNodeButtonClick}>Add Node</button>
       <button className="add-edge-button" onClick={handleAddEdgeButtonClick}>Add Edge</button>
      </div>
      <div className="dag-visualizer">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
      {/* 编辑面板：编辑已有节点/边 */}
      {showEditor && (
        <div className="editor-panel">
          <h3>Edit {selectedElement?.source ? "Edge" : "Node"}</h3>
          {selectedElement?.source ? (
            <>
              <label>from:</label>
              <input
                type="text"
                name="from"
                value={formData.from}
                onChange={handleInputChange}
              />
              <label>to:</label>
              <input
                type="text"
                name="to"
                value={formData.to}
                onChange={handleInputChange}
              />
              <label>type:</label>
              <input
                type="text"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
              />
              <label>attributes (JSON):</label>
              <textarea
                name="attributes"
                value={JSON.stringify(formData.attributes)}
                onChange={(e) => {
                  try {
                    setFormData({
                      ...formData,
                      attributes: JSON.parse(e.target.value),
                    });
                  } catch (error) {
                    setFormData({
                      ...formData,
                      attributes: {},
                    });
                  }
                }}
              />
            </>
          ) : (
            <>
              <label>ID:</label>
              <input
                type="text"
                name="id"
                value={formData.id}
                onChange={handleInputChange}
              />
              <label>location:</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
              />
              <label>inputs (JSON):</label>
              <textarea
                name="inputs"
                value={JSON.stringify(formData.inputs)}
                onChange={(e) => {
                  try {
                    setFormData({
                      ...formData,
                      inputs: JSON.parse(e.target.value),
                    });
                  } catch (error) {
                    setFormData({
                      ...formData,
                      inputs: {},
                    });
                  }
                }}
              />
              <label>outputs (JSON):</label>
              <textarea
                name="outputs"
                value={JSON.stringify(formData.outputs)}
                onChange={(e) => {
                  try {
                    setFormData({
                      ...formData,
                      outputs: JSON.parse(e.target.value),
                    });
                  } catch (error) {
                    setFormData({
                      ...formData,
                      outputs: {},
                    });
                  }
                }}
              />
            </>
          )}
          <div className="editor-buttons">
            <button onClick={handleSave}>Save</button>
            <button onClick={handleUndo}>Undo</button>
            <button onClick={() => setShowEditor(false)}>Close</button>
          </div>
        </div>
      )}
      {/* 新增节点面板 */}
      {showAddNode && (
        <div className="editor-panel">
          <h3>Add Node</h3>
          <label>ID:</label>
          <input
            type="text"
            name="id"
            value={newNodeData.id}
            onChange={handleNewNodeInputChange}
          />
          <label>location:</label>
          <input
            type="text"
            name="location"
            value={newNodeData.location}
            onChange={handleNewNodeInputChange}
          />
          <label>inputs (JSON):</label>
          <textarea
            name="inputs"
            value={newNodeData.inputs}
            onChange={handleNewNodeInputChange}
          />
          <label>outputs (JSON):</label>
          <textarea
            name="outputs"
            value={newNodeData.outputs}
            onChange={handleNewNodeInputChange}
          />
          <div className="editor-buttons">
            <button onClick={handleAddNodeSave}>Save</button>
            <button onClick={() => setShowAddNode(false)}>Cancel</button>
          </div>
        </div>
      )}
      {/* 新增边面板 */}
      {showAddEdge && (
        <div className="editor-panel">
          <h3>Add Edge</h3>
          <label>from:</label>
          <input
            type="text"
            name="from"
            value={newEdgeData.from}
            onChange={handleNewEdgeInputChange}
          />
          <label>to:</label>
          <input
            type="text"
            name="to"
            value={newEdgeData.to}
            onChange={handleNewEdgeInputChange}
          />
          <label>type:</label>
          <input
            type="text"
            name="type"
            value={newEdgeData.type}
            onChange={handleNewEdgeInputChange}
          />
          <label>attributes (JSON):</label>
          <textarea
            name="attributes"
            value={newEdgeData.attributes}
            onChange={handleNewEdgeInputChange}
          />
          <div className="editor-buttons">
            <button onClick={handleAddEdgeSave}>Save</button>
            <button onClick={() => setShowAddEdge(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DAGVisualizer;
