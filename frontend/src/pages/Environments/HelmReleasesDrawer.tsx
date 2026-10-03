import React, { useCallback, useEffect, useState } from 'react';
import { Drawer, Table, Tag, Button, Space, Typography, Empty, Spin, Card, Tooltip, Alert } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SyncOutlined, DiffOutlined, CodeOutlined } from '@ant-design/icons';
import http from '../../api/client';
import YamlDiffEditor from '../../components/Editor/YamlDiffEditor';
import HelmRendersetDrawer from './HelmRendersetDrawer';
import { feedback } from '../../utils/feedback';

const { Text } = Typography;

// 契约（environment/handler/helm.go + service/helm.go）：
// GET  /api/aslan/environment/environments/:envName/helm/releases?projectName=&production=
//      → HelmReleaseResp[] {releaseName,serviceName,revision,chart,chartVersion,appVersion,overrideValues,overrideYaml,status,updatable,isHelmChartDeploy}
// GET  .../helm/releases/diffs?projectName=&production= → [{serviceName,releaseName,isHelmChartDeploy,diff{hasDiff,versionChanged,valuesChanged,currentRevision,latestRevision,error}}]
// GET  .../helm/releases/:name/diff?projectName=&production=&isHelmChartDeploy=
//      → {serviceName,releaseName,hasDiff,diff,versionDiff,valuesDiff{current,latest},valuesSourceDiff}

interface HelmReleaseResp {
  releaseName: string;
  serviceName: string;
  revision: number;
  chartRepo?: string;
  chart?: string;
  chartVersion?: string;
  appVersion?: string;
  overrideValues?: string;
  overrideYaml?: string;
  status: string;
  updatable?: boolean;
  isHelmChartDeploy?: boolean;
}

interface DiffSummary {
  serviceName: string;
  releaseName: string;
  isHelmChartDeploy: boolean;
  diff?: { hasDiff: boolean; versionChanged: boolean; valuesChanged: boolean; currentRevision: number; latestRevision: number; error?: string } | null;
}

interface HelmReleaseDiff {
  serviceName: string;
  releaseName: string;
  hasDiff: boolean;
  valuesDiff?: { current: string; latest: string } | null;
  versionDiff?: { currentRevision: number; latestRevision: number } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  envName: string;
  projectName: string;
  production?: boolean;
}

const statusColor = (s: string) => {
  if (s === 'deployed') return 'success';
  if (s === 'failed') return 'error';
  if (s === 'pending' || s === 'pending-install' || s === 'pending-upgrade') return 'processing';
  if (s === 'uninstalling') return 'warning';
  return 'default';
};

export const HelmReleasesDrawer: React.FC<Props> = ({ open, onClose, envName, projectName, production = false }) => {
  const [releases, setReleases] = useState<HelmReleaseResp[]>([]);
  const [diffs, setDiffs] = useState<Record<string, DiffSummary>>({});
  const [loading, setLoading] = useState(false);
  const [detailDiff, setDetailDiff] = useState<HelmReleaseDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [rendersetOpen, setRendersetOpen] = useState(false);

  const prodParam = production ? 'true' : 'false';

  const load = useCallback(async () => {
    if (!envName || !projectName || !open) return;
    setLoading(true);
    setReleases([]);
    setDiffs({});
    try {
      const relRes = await http.get<HelmReleaseResp[]>(
        `/api/aslan/environment/environments/${encodeURIComponent(envName)}/helm/releases?projectName=${encodeURIComponent(projectName)}&production=${prodParam}`,
        { skipErrorHandler: true }
      );
      setReleases(Array.isArray(relRes) ? relRes : []);
    } catch {
      setReleases([]);
    }
    try {
      const diffRes = await http.get<DiffSummary[]>(
        `/api/aslan/environment/environments/${encodeURIComponent(envName)}/helm/releases/diffs?projectName=${encodeURIComponent(projectName)}&production=${prodParam}`,
        { skipErrorHandler: true }
      );
      const map: Record<string, DiffSummary> = {};
      (Array.isArray(diffRes) ? diffRes : []).forEach((d) => {
        map[d.releaseName || d.serviceName] = d;
      });
      setDiffs(map);
    } catch {
      setDiffs({});
    } finally {
      setLoading(false);
    }
  }, [envName, projectName, prodParam, open]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const openDiff = async (release: HelmReleaseResp) => {
    setDiffLoading(true);
    setDetailDiff(null);
    try {
      const res = await http.get<HelmReleaseDiff>(
        `/api/aslan/environment/environments/${encodeURIComponent(envName)}/helm/releases/${encodeURIComponent(release.releaseName)}/diff?projectName=${encodeURIComponent(projectName)}&production=${prodParam}&isHelmChartDeploy=${release.isHelmChartDeploy ? 'true' : 'false'}`,
        { skipErrorHandler: true }
      );
      if (res) {
        setDetailDiff(res);
        if (!res.hasDiff) feedback.message.info(`${res.releaseName || res.serviceName} 无差异`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { description?: string; message?: string } } })?.response?.data?.description || '获取差异失败';
      feedback.message.error(msg);
    } finally {
      setDiffLoading(false);
    }
  };

  const columns: ColumnsType<HelmReleaseResp> = [
    {
      title: 'Release',
      dataIndex: 'releaseName',
      render: (n: string, r) => (
        <Space size={4}>
          <Text strong copyable>{n}</Text>
          {r.isHelmChartDeploy && <Tooltip title="以 Chart 方式部署"><Tag color="cyan">Chart</Tag></Tooltip>}
        </Space>
      ),
    },
    {
      title: 'Chart / 版本',
      key: 'chart',
      render: (_, r) => (
        <Space size={4} wrap>
          <Tag color="geekblue">{r.chart || '-'}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>v{r.chartVersion || '-'}{r.appVersion ? ` (app ${r.appVersion})` : ''}</Text>
        </Space>
      ),
    },
    { title: 'Revision', dataIndex: 'revision', width: 90, render: (n: number) => <Text code>{String(n ?? '-')}</Text> },
    { title: '状态', dataIndex: 'status', width: 110, render: (s: string) => <Tag color={statusColor(String(s || ''))}>{String(s || '未知')}</Tag> },
    {
      title: '差异',
      key: 'diff',
      width: 130,
      render: (_, r) => {
        const d = diffs[r.releaseName];
        if (!d?.diff) return <Text type="secondary">-</Text>;
        if (d.diff.error) return <Tooltip title={d.diff.error}><Tag color="error">异常</Tag></Tooltip>;
        if (d.diff.hasDiff) {
          return (
            <Space size={4} wrap>
              {d.diff.versionChanged && <Tag color="orange">版本</Tag>}
              {d.diff.valuesChanged && <Tag color="orange">Values</Tag>}
            </Space>
          );
        }
        return <Tag color="success">一致</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, r) => (
        <Button type="link" size="small" icon={<DiffOutlined />} loading={diffLoading && detailDiff === null} onClick={() => openDiff(r)}>
          查看差异
        </Button>
      ),
    },
  ];

  return (
    <Drawer
      title={`Helm Releases: ${envName}`}
      placement="right"
      open={open}
      onClose={onClose}
      size="large"
      extra={
        <Space>
          <Button icon={<CodeOutlined />} size="small" onClick={() => setRendersetOpen(true)}>
            渲染配置 (Rendersets)
          </Button>
          <Button icon={<SyncOutlined />} size="small" onClick={load} loading={loading}>
            刷新
          </Button>
        </Space>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Table
            rowKey="releaseName"
            columns={columns}
            dataSource={releases}
            pagination={false}
            size="small"
            locale={{
              emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该环境暂无 Helm Release（非 Helm 项目或环境为空）" />,
            }}
          />

          {detailDiff && (
            <Card size="small" style={{ marginTop: 16 }} title={`Values 差异: ${detailDiff.releaseName || detailDiff.serviceName}`}>
              {detailDiff.hasDiff && detailDiff.versionDiff && detailDiff.versionDiff.currentRevision !== detailDiff.versionDiff.latestRevision && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  title={`Chart 版本差异：当前 rev ${detailDiff.versionDiff.currentRevision} → 最新 rev ${detailDiff.versionDiff.latestRevision}`}
                />
              )}
              {detailDiff.valuesDiff ? (
                <YamlDiffEditor original={detailDiff.valuesDiff.current} modified={detailDiff.valuesDiff.latest} theme="light" height={360} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无 Values 差异" />
              )}
            </Card>
          )}
        </>
      )}

      {/* Helm 渲染配置抽屉 */}
      <HelmRendersetDrawer
        open={rendersetOpen}
        onClose={() => setRendersetOpen(false)}
        projectName={projectName}
        envName={envName}
        production={production}
      />
    </Drawer>
  );
};

export default HelmReleasesDrawer;