import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { Result, Button } from 'antd';
import { useAuthStore } from '../stores/auth';
import BasicLayout from '../layouts/BasicLayout';
import ProjectDetailLayout from '../layouts/ProjectDetailLayout';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';
import ProjectsPage from '../pages/Projects';
import ProjectOverviewPage from '../pages/Projects/Overview';
import ServicesPage from '../pages/Services';
import EnvironmentsPage from '../pages/Environments';
import EnvironmentWizardPage from '../pages/Environments/Wizard';
import ServiceDetailPage from '../pages/Environments/ServiceDetail';
import PipelinesPage from '../pages/Pipelines';
import PipelineExecutionPage from '../pages/Pipelines/Execution';
import InsightsPage from '../pages/Insights';
import InsightDetailPage from '../pages/Insights/Detail';
import StatisticsPage from '../pages/Statistics';
import TemplateCenterPage from '../pages/Templates';
import DeliveryPage from '../pages/Delivery';
import DirectoryPage from '../pages/Directory';
import QualityCenterPage from '../pages/Quality';
import ReleasePlanPage from '../pages/ReleasePlan';
import PlutusDeliveryPage from '../pages/Plutus';
import ResourcePage from '../pages/Resource';
import EnterprisePage from '../pages/Enterprise';
import UserProfilePage from '../pages/Profile';
import ClustersPage from '../pages/Settings/Clusters';
import CodeHostsPage from '../pages/Settings/CodeHosts';
import RegistriesPage from '../pages/Settings/Registries';
import StoragePage from '../pages/Settings/Storage';
import UsersPage from '../pages/Settings/Users';
import ProjectRBACPage from '../pages/Projects/RBAC';
import { SystemConfigPage } from '../pages/Settings/Config';
import KeyVaultPage from '../pages/Settings/KeyVault';
import SprintsPage from '../pages/Projects/Sprints';
import BuildsPage from '../pages/Projects/Builds';
import ScannersPage from '../pages/Projects/Scanners';
import ProjectWizardPage from '../pages/Projects/Wizard';
import VarsGroupPage from '../pages/Projects/VarsGroup';
import ProjectHostsPage from '../pages/Projects/Hosts';
import ProjectAgentsPage from '../pages/Projects/Agents';
import SystemIntegrationPage from '../pages/Settings/Integration';
import InstallationSignUpPage from '../pages/Installation/SignUp';
import InstallationVersionPage from '../pages/Installation/Version';

export const MobileProjectDetailRedirect: React.FC = () => {
  const { projectName } = useParams<{ projectName?: string }>();
  return <Navigate to={`/v1/projects/detail/${projectName || ''}/detail`} replace />;
};

const MobileWorkflowDetailRedirect: React.FC = () => {
  const { projectName, workflowName, taskId } = useParams<{ projectName?: string; workflowName?: string; taskId?: string }>();
  if (taskId) {
    return <Navigate to={`/v1/projects/detail/${projectName || ''}/pipelines/${workflowName || ''}/task/${taskId}`} replace />;
  }
  return <Navigate to={`/v1/projects/detail/${projectName || ''}/pipelines/${workflowName || ''}`} replace />;
};

// P1-R1：移动端测试深链 — 携带 testName 时进入测试详情，否则回落测试中心
const MobileTestDetailRedirect: React.FC = () => {
  const { projectName, testName } = useParams<{ projectName?: string; testName?: string }>();
  if (testName) {
    return <Navigate to={`/v1/projects/detail/${projectName || ''}/test/detail/${testName}`} replace />;
  }
  return <Navigate to={`/v1/projects/detail/${projectName || ''}/test`} replace />;
};

// P1-R1：移动端环境深链 — 携带 envName 时进入对应环境（envs/:envName 直接绑定路由参数），否则回落环境列表
const MobileEnvDetailRedirect: React.FC = () => {
  const { projectName, envName } = useParams<{ projectName?: string; envName?: string }>();
  if (envName) {
    return <Navigate to={`/v1/projects/detail/${projectName || ''}/envs/${envName}`} replace />;
  }
  return <Navigate to={`/v1/projects/detail/${projectName || ''}/envs`} replace />;
};

// R10 任务三: 诚实 404 页（不再将坏链静默吞回 dashboard）
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div style={{ padding: '60px 24px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <Result
        status="404"
        title="404"
        subTitle="抱歉，您访问的页面不存在或已被移除"
        extra={
          <Button type="primary" onClick={() => navigate('/v1/dashboard')}>
            返回工作台
          </Button>
        }
      />
    </div>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?redirect=${redirect}`} replace />;
  }

  return <>{children}</>;
};

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Support both /signin and /login routes matching live Zadig */}
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/login/password" element={<LoginPage />} />
        {/* MFA 挑战入口：带 mfa_challenge_token 参数时 LoginPage 进入验证/绑定流程 */}
        <Route path="/mfa-enroll" element={<LoginPage />} />

        {/* Installation & Initial Setup Routes (decompiled from Chunk 105 & Chunk 106) */}
        <Route path="/v1/installation/signup" element={<InstallationSignUpPage />} />
        <Route path="/v1/installation/version" element={<InstallationVersionPage />} />

        <Route
          path="/v1"
          element={
            <ProtectedRoute>
              <BasicLayout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard & Status */}
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="status" element={<DashboardPage />} />
          <Route path="" element={<Navigate to="dashboard" replace />} />

          {/* Global Projects Overview & Creation / Edit Wizard */}
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/create" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName/k8s/info" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName/k8s/:step" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName/:deployType/:step" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName/*" element={<ProjectWizardPage />} />
          <Route path="projects/edit/:projectName" element={<ProjectOverviewPage />} />
          <Route path="projects/initialize/:projectName" element={<ProjectOverviewPage />} />

          {/* Project-Scoped Workspace with Secondary Sub-Navigation */}
          <Route path="projects/detail/:projectName" element={<ProjectDetailLayout />}>
            <Route index element={<Navigate to="detail" replace />} />
            <Route path="detail" element={<ProjectOverviewPage />} />
            <Route path="pipelines" element={<PipelinesPage />} />
            <Route path="pipelines/:name" element={<PipelinesPage />} />
            <Route path="pipelines/:name/task/:taskId" element={<PipelineExecutionPage />} />
            <Route path="pipelines/custom/create" element={<PipelinesPage />} />
            <Route path="pipelines/custom/edit/:name" element={<PipelinesPage />} />
            <Route path="pipelines/custom/:name" element={<PipelinesPage />} />
            <Route path="pipelines/custom/:name/:taskId" element={<PipelineExecutionPage />} />
            <Route path="pipelines/custom/testcase/*" element={<PipelineExecutionPage />} />
            {/* Workflows (Official V4 Deep Link Aliases) */}
            <Route path="workflows" element={<PipelinesPage />} />
            <Route path="workflows/:name" element={<PipelinesPage />} />
            <Route path="workflows/:name/task/:taskId" element={<PipelineExecutionPage />} />
            <Route path="workflows/custom/create" element={<PipelinesPage />} />
            <Route path="workflows/custom/edit/:name" element={<PipelinesPage />} />
            <Route path="workflows/custom/:name" element={<PipelinesPage />} />
            <Route path="workflows/custom/:name/:taskId" element={<PipelineExecutionPage />} />
            <Route path="workflows/*" element={<PipelinesPage />} />
            <Route path="envs" element={<EnvironmentsPage />} />
            <Route path="envs/create" element={<EnvironmentWizardPage />} />
            <Route path="envs/detail" element={<EnvironmentsPage />} />
            <Route path="envs/detail/:serviceName" element={<ServiceDetailPage />} />
            <Route path="envs/detail/:serviceName/*" element={<ServiceDetailPage />} />
            <Route path="envs/production/create" element={<EnvironmentWizardPage />} />
            <Route path="envs/production/host/create" element={<EnvironmentWizardPage />} />
            <Route path="envs/sae/create" element={<EnvironmentWizardPage />} />
            <Route path="envs/sae/production/create" element={<EnvironmentWizardPage />} />
            <Route path="envs/sae/config" element={<EnvironmentsPage />} />
            <Route path="envs/sae/changeOrder" element={<EnvironmentsPage />} />
            <Route path="envs/sae/changeOrder/:orderId/detail" element={<EnvironmentsPage />} />
            <Route path="envs/sae/changeOrder/*" element={<EnvironmentsPage />} />
            <Route path="envs/:envName" element={<EnvironmentsPage />} />
            <Route path="envs/:envName/k8s/:serviceName" element={<ServiceDetailPage />} />
            <Route path="envs/:envName/helm/:serviceName" element={<ServiceDetailPage />} />
            <Route path="envs/:envName/pm/:serviceName" element={<ServiceDetailPage />} />
            <Route path="envs/:envName/log" element={<EnvironmentsPage />} />
            <Route path="envs/:envName/*" element={<EnvironmentsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/production" element={<ServicesPage />} />
            <Route path="sprints" element={<SprintsPage />} />
            <Route path="sprints/config" element={<SprintsPage />} />
            <Route path="builds" element={<BuildsPage />} />
            <Route path="builds/create" element={<BuildsPage />} />
            <Route path="builds/detail/:buildName" element={<BuildsPage />} />
            <Route path="test" element={<QualityCenterPage />} />
            <Route path="test/*" element={<QualityCenterPage />} />
            {/* Tests (Official Deep Link Aliases) */}
            <Route path="tests" element={<QualityCenterPage />} />
            <Route path="tests/detail/:testName" element={<QualityCenterPage />} />
            <Route path="tests/detail/:testName/:taskId" element={<QualityCenterPage />} />
            <Route path="tests/:testName" element={<QualityCenterPage />} />
            <Route path="tests/:testName/:taskId" element={<QualityCenterPage />} />
            <Route path="tests/*" element={<QualityCenterPage />} />
            <Route path="scanner" element={<ScannersPage />} />
            <Route path="scanner/create" element={<ScannersPage />} />
            <Route path="scanner/edit/:scannerName" element={<ScannersPage />} />
            <Route path="scanner/ai-review/create" element={<ScannersPage />} />
            <Route path="scanner/ai-review/edit/:scannerName" element={<ScannersPage />} />
            <Route path="scanner/detail/:scannerName" element={<ScannersPage />} />
            <Route path="scanner/detail/:scannerName/task/:taskId" element={<ScannersPage />} />
            <Route path="version" element={<DeliveryPage />} />
            <Route path="version/helm/create" element={<DeliveryPage />} />
            <Route path="version/k8s/create" element={<DeliveryPage />} />
            <Route path="version/detail/:id" element={<DeliveryPage />} />
            <Route path="version/*" element={<DeliveryPage />} />

            {/* Project Config & Secondary Navigation */}
            <Route path="group" element={<VarsGroupPage />} />
            <Route path="group/create" element={<VarsGroupPage />} />
            <Route path="secrets" element={<KeyVaultPage />} />
            <Route path="rbac" element={<ProjectRBACPage />} />
            <Route path="hosts" element={<ProjectHostsPage />} />
            <Route path="agents" element={<ProjectAgentsPage />} />
            <Route path="agents/:agentId/config" element={<ProjectAgentsPage />} />
            <Route path="agents/*" element={<ProjectAgentsPage />} />
            <Route path="integration" element={<SystemIntegrationPage />} />
            <Route path="integration/:category" element={<SystemIntegrationPage />} />
          </Route>

          {/* Global Release & Pipelines */}
          <Route path="pipelines" element={<Navigate to="/v1/releaseWorkflow" replace />} />
          <Route path="releaseWorkflow" element={<PipelinesPage />} />
          <Route path="pipelines/:name/task/:taskId" element={<PipelineExecutionPage />} />
          <Route path="releasePlan" element={<ReleasePlanPage />} />
          <Route path="releasePlan/index" element={<ReleasePlanPage />} />
          <Route path="releasePlan/detail" element={<ReleasePlanPage />} />
          <Route path="releasePlan/*" element={<ReleasePlanPage />} />
          <Route path="plutus" element={<PlutusDeliveryPage />} />
          <Route path="plutus/*" element={<PlutusDeliveryPage />} />

          {/* Standalone Fallbacks for Services & Envs */}
          <Route path="services" element={<ServicesPage />} />
          <Route path="envs" element={<EnvironmentsPage />} />
          <Route path="envs/:envName" element={<EnvironmentsPage />} />

          {/* Asset Management Routes */}
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="directory/detail/:id" element={<DirectoryPage />} />
          <Route path="directory/*" element={<DirectoryPage />} />
          <Route path="template" element={<Navigate to="k8s-yamls" replace />} />
          <Route path="template/charts" element={<TemplateCenterPage />} />
          <Route path="template/dockerfiles" element={<TemplateCenterPage />} />
          <Route path="template/k8s-yamls" element={<TemplateCenterPage />} />
          <Route path="template/builds" element={<TemplateCenterPage />} />
          <Route path="template/scanners" element={<TemplateCenterPage />} />
          <Route path="template/workflows" element={<TemplateCenterPage />} />
          <Route path="template/workflows/config" element={<TemplateCenterPage />} />
          <Route path="template/releasePlan" element={<TemplateCenterPage />} />
          <Route path="template/:tab" element={<TemplateCenterPage />} />
          <Route path="tests" element={<QualityCenterPage />} />
          <Route path="tests/*" element={<QualityCenterPage />} />
          <Route path="delivery" element={<Navigate to="version" replace />} />
          <Route path="delivery/version" element={<DeliveryPage />} />
          <Route path="delivery/version/detail/:projectName/:id" element={<DeliveryPage />} />
          <Route path="delivery/artifacts" element={<DeliveryPage />} />
          <Route path="delivery/artifacts/detail/:id" element={<DeliveryPage />} />
          <Route path="delivery/:tab" element={<DeliveryPage />} />
          <Route path="resource" element={<Navigate to="cluster" replace />} />
          <Route path="resource/cluster" element={<ResourcePage />} />
          <Route path="resource/host" element={<ResourcePage />} />
          <Route path="resource/registry" element={<ResourcePage />} />
          <Route path="resource/helmChartRepo" element={<ResourcePage />} />
          <Route path="resource/storage" element={<ResourcePage />} />
          <Route path="resource/database" element={<ResourcePage />} />
          <Route path="resource/:tab" element={<ResourcePage />} />

          {/* Insights & Statistics */}
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="insight" element={<Navigate to="view" replace />} />
          <Route path="insight/board" element={<InsightsPage />} />
          <Route path="insight/view" element={<InsightsPage />} />
          <Route path="insight/config" element={<InsightsPage />} />
          <Route path="insight/detail" element={<Navigate to="overview" replace />} />
          <Route path="insight/detail/:dimension" element={<InsightDetailPage />} />
          <Route path="insights" element={<InsightsPage />} />

          {/* User Profile & MCP Configuration */}
          <Route path="profile" element={<Navigate to="info" replace />} />
          <Route path="profile/info" element={<UserProfilePage />} />
          <Route path="profile/mcp" element={<UserProfilePage />} />
          <Route path="profile/security" element={<UserProfilePage />} />
          <Route path="profile/preference" element={<UserProfilePage />} />
          <Route path="profile/*" element={<UserProfilePage />} />

          {/* Enterprise Management */}
          <Route path="enterprise" element={<Navigate to="info" replace />} />
          <Route path="enterprise/info" element={<EnterprisePage />} />
          <Route path="enterprise/license" element={<EnterprisePage />} />
          <Route path="enterprise/theme" element={<EnterprisePage />} />
          <Route path="enterprise/language" element={<EnterprisePage />} />
          <Route path="enterprise/*" element={<EnterprisePage />} />

          {/* System Settings Routes */}
          <Route path="system" element={<Navigate to="integration" replace />} />
          <Route path="system/clusters" element={<ClustersPage />} />
          <Route path="system/codehosts" element={<CodeHostsPage />} />
          <Route path="system/registries" element={<RegistriesPage />} />
          <Route path="system/storage" element={<StoragePage />} />
          <Route path="system/users" element={<UsersPage />} />
          <Route path="system/config" element={<SystemConfigPage />} />
          <Route path="system/apps" element={<SystemConfigPage />} />
          <Route path="system/imgs" element={<SystemConfigPage />} />
          <Route path="system/workflowTasks" element={<SystemConfigPage />} />
          <Route path="system/plugins" element={<SystemConfigPage />} />
          <Route path="system/secrets" element={<KeyVaultPage />} />
          <Route path="system/aiCodeReview" element={<SystemConfigPage />} />
          <Route path="system/labels" element={<SystemConfigPage />} />
          <Route path="system/announcement" element={<SystemConfigPage />} />
          <Route path="system/auditlog" element={<SystemConfigPage />} />
          <Route path="system/integration" element={<SystemIntegrationPage />} />
          <Route path="system/integration/:category" element={<SystemIntegrationPage />} />
          <Route path="system/*" element={<Navigate to="integration" replace />} />

          {/* Plugin Extension Container */}
          <Route
            path="plugin/*"
            element={
              <div style={{ padding: 32, background: '#fff', borderRadius: 8, textAlign: 'center' }}>
                <h3>第三方扩展插件</h3>
                <p style={{ color: '#8c8c8c' }}>已启用插件容器与协议代理。</p>
              </div>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Mobile Route Compatibility (Redirects to Desktop Portal Equivalents with Dynamic Param Interpolation) */}
        <Route path="/mobile" element={<Navigate to="/v1/dashboard" replace />} />
        <Route path="/mobile/status" element={<Navigate to="/v1/status" replace />} />
        <Route path="/mobile/profile" element={<Navigate to="/v1/profile/info" replace />} />
        <Route path="/mobile/projects" element={<Navigate to="/v1/projects" replace />} />
        <Route path="/mobile/projects/detail/:projectName" element={<MobileProjectDetailRedirect />} />
        <Route path="/mobile/projects/detail/:projectName/workflows/:workflowName" element={<MobileWorkflowDetailRedirect />} />
        <Route path="/mobile/projects/detail/:projectName/workflows/:workflowName/:taskId" element={<MobileWorkflowDetailRedirect />} />
        {/* P1-R1: 移动端测试与环境深链（动态参数插值，兜底 /mobile/* 保持末位） */}
        <Route path="/mobile/projects/detail/:projectName/tests" element={<MobileTestDetailRedirect />} />
        <Route path="/mobile/projects/detail/:projectName/tests/:testName" element={<MobileTestDetailRedirect />} />
        <Route path="/mobile/projects/detail/:projectName/envs" element={<MobileEnvDetailRedirect />} />
        <Route path="/mobile/projects/detail/:projectName/envs/detail/:envName" element={<MobileEnvDetailRedirect />} />
        <Route path="/mobile/*" element={<Navigate to="/v1/dashboard" replace />} />

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="/" element={<Navigate to="/v1/dashboard" replace />} />
        {/* R10 任务三: 根级未匹配保持诚实 404，不再把坏链吞回 dashboard */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
