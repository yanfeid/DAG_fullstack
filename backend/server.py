from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import yaml
from pydantic import BaseModel

app = FastAPI()

# 允许前端访问 API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 文件路径配置
ORIGINAL_YAML = "original_dag.yaml"      # 保持原始内容，不会被更新
VERIFIED_YAML = "verified_yaml.yaml"      # 修改操作都将写入此文件

# 读取修改后的 verified_yaml 文件
def load_verified_yaml():
    with open(VERIFIED_YAML, "r") as file:
        return yaml.safe_load(file)

# 读取原始 YAML 文件
def load_original_yaml():
    with open(ORIGINAL_YAML, "r") as file:
        return yaml.safe_load(file)

# 定义请求数据格式
class DAGUpdateRequest(BaseModel):
    dag_yaml: str

@app.get("/get-dag")
def get_dag():
    """返回修改后的 DAG（verified_yaml）"""
    return load_verified_yaml()

@app.get("/get-original-dag")
def get_original_dag():
    """返回原始的 DAG，不会被更新"""
    return load_original_yaml()

@app.post("/update-dag")
def update_dag(request: DAGUpdateRequest):
    dag_data = yaml.safe_load(request.dag_yaml)
    # 更新修改后的 DAG 文件
    with open(VERIFIED_YAML, "w") as file:
        yaml.dump(dag_data, file)
    return {"message": "✅ 修改后的 DAG 已保存！"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
