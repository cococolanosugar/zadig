import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Drawer,
  Row,
  Col,
  Card,
  Tree,
  Button,
  Space,
  Typography,
  Tag,
  Empty,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  Alert,
  Tooltip,
  Divider,
} from 'antd';
import {
  FolderOutlined,
  FileTextOutlined,
  CodeOutlined,
  SaveOutlined,
  ReloadOutlined,
  PlusOutlined,
  AppstoreAddOutlined,
  SettingOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import YamlEditor from '../../components/Editor/YamlEditor';
import { feedback } from '../../utils/feedback';
import {
  serviceApi,
  ServiceDetail,
  HelmFileInfo,
  HelmServiceCreationArgs,
  BulkHelmServiceCreationArgs,
} from '../../api/service';

const { Text } = Typography;

interface HelmServiceDrawerProps {
  open: boolean;
  onClose: () => void;
  projectName: string;
  isProduction?: boolean;
}

export const HelmServiceDrawer: React.FC<HelmServiceDrawerProps> = ({
  open,
  onClose,
  projectName,
  isProduction = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [helmServices, setHelmServices] = useState<ServiceDetail[]>([]);
  const [selectedServiceName, setSelectedServiceName] = useState<string>('');

  // 文件目录树
  const [treeLoading, setTreeLoading] = useState(false);
  const [fileList, setFileList] = useState<HelmFileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ filePath: string; fileName: string } | null>(null);

  // 文件内容
  const [fileContent, setFileContent] = useState<string>('');
  const [fileLoading, setFileLoading] = useState(false);
  const [savingFile, setSavingFile] = useState(false);

  // 关联组件模块
  const [modules, setModules] = useState<Array<{ name: string; image: string }>>([]);

  // 弹窗状态
  const [namingModalOpen, setNamingModalOpen] = useState(false);
  const [namingRule, setNamingRule] = useState('');
  const [namingLoading, setNamingLoading] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm] = Form.useForm();

  // 加载 Helm 服务列表
  const loadHelmServices = useCallback(async () => {
    if (!projectName || !open) return;
    setLoading(true);
    try {
      const res = await serviceApi.listHelmServices(projectName, isProduction);
      const list = res?.service_infos || [];
      setHelmServices(list);
      if (list.length > 0) {
        if (!selectedServiceName || !list.some((s) => s.service_name === selectedServiceName)) {
          setSelectedServiceName(list[0].service_name);
        }
      } else {
        setSelectedServiceName('');
        setFileList([]);
        setSelectedFile(null);
        setFileContent('');
      }
    } catch {
      // 捕获非 Helm 项目或列表为空
      setHelmServices([]);
      setSelectedServiceName('');
      setFileList([]);
      setSelectedFile(null);
      setFileContent('');
    } finally {
      setLoading(false);
    }
  }, [projectName, open, isProduction, selectedServiceName]);

  useEffect(() => {
    if (open) {
      loadHelmServices();
    }
  }, [open, loadHelmServices]);

  // 加载选中服务的文件树与模块
  const loadServiceFiles = useCallback(async (serviceName: string) => {
    if (!projectName || !serviceName) return;
    setTreeLoading(true);
    try {
      const files = await serviceApi.getHelmFilePath(projectName, serviceName, '', 0, isProduction);
      setFileList(files);

      // 默认选择 values.yaml
      const valuesFile = files.find((f) => !f.is_dir && (f.name === 'values.yaml' || f.name.endsWith('values.yaml')));
      if (valuesFile) {
        const fullPath = valuesFile.parent ? `${valuesFile.parent}/${valuesFile.name}` : valuesFile.name;
        setSelectedFile({ filePath: fullPath, fileName: valuesFile.name });
      } else if (files.length > 0) {
        const firstFile = files.find((f) => !f.is_dir) || files[0];
        const fullPath = firstFile.parent ? `${firstFile.parent}/${firstFile.name}` : firstFile.name;
        setSelectedFile({ filePath: fullPath, fileName: firstFile.name });
      } else {
        setSelectedFile(null);
        setFileContent('');
      }

      // 获取服务模块
      try {
        const moduleResp = await serviceApi.getHelmServiceModule(projectName, serviceName, 0, isProduction);
        setModules(moduleResp?.service_modules || []);
      } catch {
        setModules([]);
      }
    } catch {
      setFileList([]);
      setSelectedFile(null);
      setFileContent('');
      setModules([]);
    } finally {
      setTreeLoading(false);
    }
  }, [projectName, isProduction]);

  useEffect(() => {
    if (selectedServiceName) {
      loadServiceFiles(selectedServiceName);
    }
  }, [selectedServiceName, loadServiceFiles]);

  // 加载具体文件内容
  const loadFileContent = useCallback(async (file: { filePath: string; fileName: string }) => {
    if (!projectName || !selectedServiceName || !file) return;
    setFileLoading(true);
    try {
      const content = await serviceApi.getHelmFileContent(
        projectName,
        selectedServiceName,
        file.filePath,
        file.fileName,
        0,
        false,
        isProduction
      );
      setFileContent(content);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '获取文件内容失败';
      feedback.message.error(msg);
      setFileContent('');
    } finally {
      setFileLoading(false);
    }
  }, [projectName, selectedServiceName, isProduction]);

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile);
    }
  }, [selectedFile, loadFileContent]);

  // 构造 Ant Design Tree 节点
  const treeData = useMemo<DataNode[]>(() => {
    if (!fileList || fileList.length === 0) return [];

    const rootNodes: Record<string, DataNode> = {};

    fileList.forEach((file) => {
      const fullPath = file.parent ? `${file.parent}/${file.name}` : file.name;
      const isValues = file.name === 'values.yaml';

      const node: DataNode = {
        key: fullPath,
        title: (
          <span>
            {file.name}
            {isValues && (
              <Tag color="processing" style={{ marginLeft: 6, fontSize: 10, lineHeight: '16px' }}>
                可编辑
              </Tag>
            )}
          </span>
        ),
        isLeaf: !file.is_dir,
        icon: file.is_dir ? (
          <FolderOutlined style={{ color: '#fa8c16' }} />
        ) : file.name.endsWith('.yaml') || file.name.endsWith('.yml') ? (
          <CodeOutlined style={{ color: '#1890ff' }} />
        ) : (
          <FileTextOutlined style={{ color: '#8c8c8c' }} />
        ),
      };

      if (!file.parent) {
        rootNodes[file.name] = node;
      } else {
        const parts = file.parent.split('/');
        let currentParent = rootNodes[parts[0]];
        if (!currentParent) {
          currentParent = {
            key: parts[0],
            title: parts[0],
            isLeaf: false,
            icon: <FolderOutlined style={{ color: '#fa8c16' }} />,
            children: [],
          };
          rootNodes[parts[0]] = currentParent;
        }
        for (let i = 1; i < parts.length; i++) {
          if (!currentParent.children) currentParent.children = [];
          let nextParent = currentParent.children.find((c) => c.key === parts.slice(0, i + 1).join('/'));
          if (!nextParent) {
            nextParent = {
              key: parts.slice(0, i + 1).join('/'),
              title: parts[i],
              isLeaf: false,
              icon: <FolderOutlined style={{ color: '#fa8c16' }} />,
              children: [],
            };
            currentParent.children.push(nextParent);
          }
          currentParent = nextParent;
        }
        if (!currentParent.children) currentParent.children = [];
        currentParent.children.push(node);
      }
    });

    return Object.values(rootNodes);
  }, [fileList]);

  // 保存 values.yaml
  const handleSaveValuesYaml = async () => {
    if (!selectedServiceName || !selectedFile) return;
    if (selectedFile.fileName !== 'values.yaml') {
      feedback.message.warning('后端约束：仅 values.yaml 允许在线编辑保存');
      return;
    }
    setSavingFile(true);
    try {
      await serviceApi.updateHelmFileContent(
        selectedServiceName,
        projectName,
        {
          file_path: selectedFile.filePath,
          file_content: fileContent,
          production: isProduction,
        },
        isProduction
      );
      feedback.message.success('values.yaml 保存成功');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存失败，请检查语法与权限';
      feedback.message.error(msg);
    } finally {
      setSavingFile(false);
    }
  };

  // 保存发布命名规则
  const handleSaveNamingRule = async () => {
    if (!selectedServiceName) return;
    setNamingLoading(true);
    try {
      await serviceApi.updateHelmReleaseNaming(
        projectName,
        {
          service_name: selectedServiceName,
          naming: namingRule,
        },
        isProduction
      );
      feedback.message.success('发布命名规则已更新');
      setNamingModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '保存发布命名规则失败';
      feedback.message.error(msg);
    } finally {
      setNamingLoading(false);
    }
  };

  // 创建 Helm 服务
  const handleCreateHelmService = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);

      let createFrom: Record<string, unknown> = {};
      if (values.source === 'repo') {
        createFrom = {
          codehostID: values.codehostID,
          repo: values.repo,
          branch: values.branch,
          paths: values.paths ? values.paths.split(',').map((p: string) => p.trim()) : [],
        };
      } else if (values.source === 'publicRepo') {
        createFrom = {
          repoLink: values.repoLink,
          paths: values.paths ? values.paths.split(',').map((p: string) => p.trim()) : [],
        };
      } else if (values.source === 'chartRepo') {
        createFrom = {
          chartRepoName: values.chartRepoName,
          chartName: values.chartName,
          chartVersion: values.chartVersion,
        };
      } else if (values.source === 'chartTemplate') {
        createFrom = {
          templateName: values.templateName,
          valuesYAML: values.valuesYAML || '',
        };
      }

      const payload: HelmServiceCreationArgs = {
        name: values.name,
        source: values.source,
        auto_sync: values.auto_sync ?? false,
        createFrom,
        production: isProduction,
      };

      await serviceApi.createHelmService(projectName, payload, isProduction);
      feedback.message.success(`Helm 服务 ${values.name} 创建成功`);
      setCreateModalOpen(false);
      createForm.resetFields();
      await loadHelmServices();
      setSelectedServiceName(values.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '创建失败，请核对参数';
      feedback.message.error(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  // 批量导入 Helm 服务
  const handleBulkCreate = async () => {
    try {
      const values = await bulkForm.validateFields();
      setBulkLoading(true);

      const paths = values.paths ? values.paths.split('\n').map((p: string) => p.trim()).filter(Boolean) : [];
      let createFrom: Record<string, unknown> = {};

      if (values.source === 'repo') {
        createFrom = {
          codehostID: values.codehostID,
          repo: values.repo,
          branch: values.branch,
          paths,
        };
      } else {
        createFrom = {
          templateName: values.templateName,
          valuesYAML: values.valuesYAML || '',
        };
      }

      const payload: BulkHelmServiceCreationArgs = {
        source: values.source,
        createFrom,
        auto_sync: values.auto_sync ?? false,
        production: isProduction,
      };

      const res = await serviceApi.createBulkHelmServices(projectName, payload, isProduction);
      const successCount = res.successServices?.length || 0;
      const failedCount = res.failedServices?.length || 0;
      feedback.message.success(`批量导入完成：成功 ${successCount} 个，失败 ${failedCount} 个`);
      setBulkModalOpen(false);
      bulkForm.resetFields();
      await loadHelmServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '批量导入失败';
      feedback.message.error(msg);
    } finally {
      setBulkLoading(false);
    }
  };

  const isValuesYaml = selectedFile?.fileName === 'values.yaml';

  return (
    <>
      <Drawer
        title={
          <Space>
            <span>Helm 服务管理</span>
            {isProduction ? <Tag color="orange">生产</Tag> : <Tag color="blue">测试</Tag>}
          </Space>
        }
        open={open}
        onClose={onClose}
        size="large"
        destroyOnHidden
        extra={
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={() => {
                createForm.resetFields();
                setCreateModalOpen(true);
              }}
            >
              新建 Helm 服务
            </Button>
            <Button
              icon={<AppstoreAddOutlined />}
              onClick={() => {
                bulkForm.resetFields();
                setBulkModalOpen(true);
              }}
            >
              批量导入
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadHelmServices} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {helmServices.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  当前项目暂无 Helm 服务组件。
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    提示：若当前项目为标准 K8s YAML 类型，请通过服务列表进行管理；若需管理 Helm 服务，可点击上方「新建 Helm 服务」或「批量导入」。
                  </Text>
                </span>
              }
              style={{ padding: '80px 0' }}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  createForm.resetFields();
                  setCreateModalOpen(true);
                }}
              >
                新建第一个 Helm 服务
              </Button>
            </Empty>
          ) : (
            <Row gutter={[16, 16]}>
              {/* 左侧：服务选择与 Chart 目录树 */}
              <Col span={8}>
                <Card variant="borderless" style={{ background: '#fafafa', borderRadius: 8 }}>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>
                    选择 Helm 服务
                  </Text>
                  <Select
                    style={{ width: '100%', marginBottom: 16 }}
                    value={selectedServiceName}
                    onChange={(val) => setSelectedServiceName(val)}
                    options={helmServices.map((s) => ({
                      value: s.service_name,
                      label: (
                        <Space>
                          <span>{s.service_name}</span>
                          {s.auto_sync && <Tag color="green" style={{ fontSize: 10 }}>自动同步</Tag>}
                        </Space>
                      ),
                    }))}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong>Chart 目录树</Text>
                    <Tooltip title="刷新文件树">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => selectedServiceName && loadServiceFiles(selectedServiceName)}
                      />
                    </Tooltip>
                  </div>

                  <Spin spinning={treeLoading}>
                    {treeData.length > 0 ? (
                      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                        <Tree
                          showIcon
                          treeData={treeData}
                          selectedKeys={selectedFile ? [selectedFile.filePath] : []}
                          onSelect={(_keys, info) => {
                            if (info.node.isLeaf) {
                              const key = String(info.node.key);
                              const parts = key.split('/');
                              const fileName = parts[parts.length - 1];
                              setSelectedFile({ filePath: key, fileName });
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文件结构" />
                    )}
                  </Spin>

                  <Divider style={{ margin: '16px 0 12px 0' }} />

                  {/* 关联组件模块 */}
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                    <CloudServerOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                    <Text strong>解析出的镜像模块 ({modules.length})</Text>
                  </div>
                  {modules.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                      {modules.map((mod) => (
                        <div key={mod.name} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <Text strong style={{ fontSize: 13, display: 'block' }}>{mod.name}</Text>
                          <Text type="secondary" ellipsis style={{ fontSize: 11, maxWidth: 220, display: 'block' }}>
                            {mod.image || '-'}
                          </Text>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12 }}>暂未解析出容器模块</Text>
                  )}
                </Card>
              </Col>

              {/* 右侧：文件查看与编辑 */}
              <Col span={16}>
                <Card
                  variant="borderless"
                  title={
                    <Space>
                      <span>{selectedFile ? selectedFile.filePath : '未选中文件'}</span>
                      {selectedFile && (
                        isValuesYaml ? (
                          <Tag color="success">在线可编辑</Tag>
                        ) : (
                          <Tag color="default">只读查看</Tag>
                        )
                      )}
                    </Space>
                  }
                  extra={
                    <Space>
                      <Button
                        icon={<SettingOutlined />}
                        size="small"
                        onClick={() => {
                          setNamingRule('');
                          setNamingModalOpen(true);
                        }}
                      >
                        发布命名规则
                      </Button>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        size="small"
                        disabled={!isValuesYaml}
                        loading={savingFile}
                        onClick={handleSaveValuesYaml}
                      >
                        保存 values.yaml
                      </Button>
                    </Space>
                  }
                  styles={{ body: { padding: 0 } }}
                >
                  {!isValuesYaml && selectedFile && (
                    <Alert
                      title="只读模式提示"
                      description="后端微服务约束（helm.go）：仅 values.yaml 允许在线修改保存，其他 Chart 模板/元数据文件仅供预览核对。"
                      type="info"
                      showIcon
                      style={{ margin: 12 }}
                    />
                  )}

                  <Spin spinning={fileLoading}>
                    {selectedFile ? (
                      <YamlEditor
                        value={fileContent}
                        onChange={setFileContent}
                        theme="vs-dark"
                        height={460}
                        readOnly={!isValuesYaml}
                      />
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="请在左侧文件树中选择要查看或编辑的文件"
                        style={{ padding: '120px 0' }}
                      />
                    )}
                  </Spin>
                </Card>
              </Col>
            </Row>
          )}
        </Spin>
      </Drawer>

      {/* Release Naming 规则配置弹窗 */}
      <Modal
        title={`配置 Helm Release 命名规则 (${selectedServiceName})`}
        open={namingModalOpen}
        onOk={handleSaveNamingRule}
        onCancel={() => setNamingModalOpen(false)}
        confirmLoading={namingLoading}
        destroyOnHidden
      >
        <div style={{ marginTop: 12, marginBottom: 12 }}>
          <Alert
            title="规则说明"
            description="支持使用 Go Template 语法定制 Helm Release 实例名称，例如: {{.Service}}-{{.Env}} 或 {{.Service}}-release"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Text strong style={{ display: 'block', marginBottom: 8 }}>
            命名规则 (Naming Rule):
          </Text>
          <Input
            placeholder="例如: {{.Service}}-{{.Env}}"
            value={namingRule}
            onChange={(e) => setNamingRule(e.target.value)}
          />
        </div>
      </Modal>

      {/* 新建 Helm 服务弹窗 */}
      <Modal
        title="新建 Helm Chart 服务"
        open={createModalOpen}
        onOk={handleCreateHelmService}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={createLoading}
        destroyOnHidden
        width={680}
      >
        <Form form={createForm} layout="vertical" initialValues={{ source: 'chartTemplate', auto_sync: false }}>
          <Form.Item
            name="name"
            label="服务名称"
            rules={[
              { required: true, message: '请输入服务名称' },
              { pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, message: '服务名称仅支持小写字母、数字及中划线' },
            ]}
          >
            <Input placeholder="例如: my-helm-service" />
          </Form.Item>

          <Form.Item name="source" label="服务来源" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'chartTemplate', label: '从 Chart 模板新建' },
                { value: 'repo', label: '从私有代码库加载' },
                { value: 'publicRepo', label: '从公开代码仓库加载' },
                { value: 'chartRepo', label: '从 Chart 仓库拉取' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.source !== curr.source}>
            {({ getFieldValue }) => {
              const src = getFieldValue('source');
              if (src === 'chartTemplate') {
                return (
                  <>
                    <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
                      <Input placeholder="例如: default-chart-template" />
                    </Form.Item>
                    <Form.Item name="valuesYAML" label="自定义 values.yaml">
                      <Input.TextArea rows={4} placeholder="key: value" />
                    </Form.Item>
                  </>
                );
              }
              if (src === 'repo') {
                return (
                  <>
                    <Form.Item name="repo" label="代码库名称" rules={[{ required: true, message: '请输入代码库名称' }]}>
                      <Input placeholder="例如: my-org/helm-charts" />
                    </Form.Item>
                    <Form.Item name="branch" label="分支" rules={[{ required: true, message: '请输入分支' }]}>
                      <Input placeholder="例如: main" />
                    </Form.Item>
                    <Form.Item name="paths" label="Chart 路径 (逗号分隔)">
                      <Input placeholder="例如: charts/my-service" />
                    </Form.Item>
                  </>
                );
              }
              if (src === 'publicRepo') {
                return (
                  <>
                    <Form.Item name="repoLink" label="公开仓库链接" rules={[{ required: true, message: '请输入 Git 仓库地址' }]}>
                      <Input placeholder="例如: https://github.com/example/charts.git" />
                    </Form.Item>
                    <Form.Item name="paths" label="Chart 路径 (逗号分隔)">
                      <Input placeholder="例如: charts/my-service" />
                    </Form.Item>
                  </>
                );
              }
              if (src === 'chartRepo') {
                return (
                  <>
                    <Form.Item name="chartRepoName" label="Chart 仓库名称" rules={[{ required: true, message: '请输入 Chart 仓库名' }]}>
                      <Input placeholder="例如: my-helm-repo" />
                    </Form.Item>
                    <Form.Item name="chartName" label="Chart 名称" rules={[{ required: true, message: '请输入 Chart 名称' }]}>
                      <Input placeholder="例如: redis" />
                    </Form.Item>
                    <Form.Item name="chartVersion" label="Chart 版本" rules={[{ required: true, message: '请输入 Chart 版本' }]}>
                      <Input placeholder="例如: 17.3.1" />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入 Helm 服务弹窗 */}
      <Modal
        title="批量导入 Helm Chart 服务"
        open={bulkModalOpen}
        onOk={handleBulkCreate}
        onCancel={() => setBulkModalOpen(false)}
        confirmLoading={bulkLoading}
        destroyOnHidden
      >
        <Form form={bulkForm} layout="vertical" initialValues={{ source: 'chartTemplate' }}>
          <Form.Item name="source" label="服务来源" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'chartTemplate', label: '从 Chart 模板批量生成' },
                { value: 'repo', label: '从代码库批量加载' },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.source !== curr.source}>
            {({ getFieldValue }) => {
              const src = getFieldValue('source');
              if (src === 'repo') {
                return (
                  <>
                    <Form.Item name="repo" label="代码库名称" rules={[{ required: true, message: '请输入代码库名称' }]}>
                      <Input placeholder="例如: my-org/helm-charts" />
                    </Form.Item>
                    <Form.Item name="branch" label="分支" rules={[{ required: true, message: '请输入分支' }]}>
                      <Input placeholder="例如: main" />
                    </Form.Item>
                    <Form.Item
                      name="paths"
                      label="Chart 路径列表 (每行一个路径)"
                      rules={[{ required: true, message: '请至少输入一个路径' }]}
                    >
                      <Input.TextArea rows={4} placeholder="charts/service-a&#10;charts/service-b" />
                    </Form.Item>
                  </>
                );
              }
              return (
                <>
                  <Form.Item name="templateName" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
                    <Input placeholder="例如: standard-microservice-template" />
                  </Form.Item>
                  <Form.Item name="valuesYAML" label="批量默认 values.yaml">
                    <Input.TextArea rows={4} placeholder="key: value" />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default HelmServiceDrawer;
