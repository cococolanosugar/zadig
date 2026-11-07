import React from 'react';
import { Typography, Button, Space } from 'antd';
import { RocketOutlined, ScheduleOutlined, BranchesOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

/**
 * 客户交付管理 (Plutus) — 社区版占位引导页
 * R11 任务一: 后端 /api/plutus/* 系列接口属企业闭源实现（社区仓库仅提供 health/license/organization），
 * 移除幻觉路由调用与无响应按钮/假版本号，改为规范 Result 引导容器。
 */
export const PlutusDeliveryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '20px 24px', backgroundColor: '#f5f7fa', minHeight: 'calc(100vh - 110px)' }}>
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, fontWeight: 600, color: '#1f2d3d' }}>
          端到端价值流交付中心 (Plutus) 规划中
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          面向私有化部署、多客户定制化分发的企业级交付管控能力，当前社区版本暂未开放该模块
        </Text>
      </div>

      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          border: '1px solid #ebeef5',
          padding: '48px 24px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <RocketOutlined style={{ fontSize: 56, color: '#0066ff', marginBottom: 24 }} />
          <Title level={4} style={{ marginBottom: 12 }}>
            社区版已支持完整的端到端交付能力
          </Title>
          <Text type="secondary" style={{ display: 'block', marginBottom: 32, fontSize: 14 }}>
            您可以通过工作流编排自动化构建、部署与测试交付，通过发布计划管理版本发布窗口与里程碑，
            并在多环境中完成灰度与正式交付。
          </Text>
          <Space size={16} wrap style={{ justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<BranchesOutlined />}
              onClick={() => navigate('/v1/releaseWorkflow')}
            >
              前往工作流交付
            </Button>
            <Button
              size="large"
              icon={<ScheduleOutlined />}
              onClick={() => navigate('/v1/releasePlan')}
            >
              前往发布计划
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default PlutusDeliveryPage;
