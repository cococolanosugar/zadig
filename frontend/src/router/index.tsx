import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import PipelinesPage from '../pages/Pipelines';
import PipelineExecutionPage from '../pages/Pipelines/Execution';
import InsightsPage from '../pages/Insights';
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
import { SystemConfigPage } from '../pages/Settings/Config';
import SprintsPage from '../pages/Projects/Sprints';
import BuildsPage from '../pages/Projects/Builds';
import ScannersPage from '../pages/Projects/Scanners';
import ProjectWizardPage from '../pages/Projects/Wizard';
import SystemIntegrationPage from '../pages/Settings/Integration';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

          {/* Global Projects Overview & Creation Wizard */}
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/create" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName/k8s/info" element={<ProjectWizardPage />} />
          <Route path="projects/create/:projectName/k8s/:step" element={<ProjectWizardPage />} />

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
            <Route path="envs" element={<EnvironmentsPage />} />
            <Route path="envs/create" element={<EnvironmentWizardPage />} />
            <Route path="envs/:envName" element={<EnvironmentsPage />} />
            <Route path="envs/:envName/k8s/:serviceName" element={<EnvironmentsPage />} />
            <Route path="envs/:envName/helm/:serviceName" element={<EnvironmentsPage />} />
            <Route path="envs/:envName/pm/:serviceName" element={<EnvironmentsPage />} />
            <Route path="envs/:envName/log" element={<EnvironmentsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="services/production" element={<ServicesPage />} />
            <Route path="sprints" element={<SprintsPage />} />
            <Route path="sprints/config" element={<SprintsPage />} />
            <Route path="builds" element={<BuildsPage />} />
            <Route path="builds/create" element={<BuildsPage />} />
            <Route path="builds/detail/:buildName" element={<BuildsPage />} />
            <Route path="test" element={<QualityCenterPage />} />
            <Route path="test/*" element={<QualityCenterPage />} />
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
            <Route path="secrets" element={<StoragePage />} />
            <Route path="rbac" element={<UsersPage />} />
            <Route path="integration/*" element={<SystemIntegrationPage />} />
          </Route>

          {/* Global Release & Pipelines */}
          <Route path="pipelines" element={<PipelinesPage />} />
          <Route path="releaseWorkflow" element={<PipelinesPage />} />
          <Route path="pipelines/:name/task/:taskId" element={<PipelineExecutionPage />} />
          <Route path="releasePlan" element={<ReleasePlanPage />} />
          <Route path="plutus" element={<PlutusDeliveryPage />} />

          {/* Standalone Fallbacks for Services & Envs */}
          <Route path="services" element={<ServicesPage />} />
          <Route path="envs" element={<EnvironmentsPage />} />
          <Route path="envs/:envName" element={<EnvironmentsPage />} />

          {/* Asset Management Routes */}
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="template" element={<TemplateCenterPage />} />
          <Route path="template/:tab" element={<TemplateCenterPage />} />
          <Route path="tests" element={<QualityCenterPage />} />
          <Route path="delivery" element={<DeliveryPage />} />
          <Route path="delivery/:tab" element={<DeliveryPage />} />
          <Route path="resource" element={<ResourcePage />} />
          <Route path="resource/:tab" element={<ResourcePage />} />

          {/* Insights & Statistics */}
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="insight" element={<InsightsPage />} />
          <Route path="insights" element={<InsightsPage />} />

          {/* User Profile & MCP Configuration */}
          <Route path="profile" element={<UserProfilePage />} />
          <Route path="profile/info" element={<UserProfilePage />} />
          <Route path="profile/mcp" element={<UserProfilePage />} />
          <Route path="profile/security" element={<UserProfilePage />} />
          <Route path="profile/preference" element={<UserProfilePage />} />

          {/* Enterprise Management */}
          <Route path="enterprise" element={<EnterprisePage />} />
          <Route path="enterprise/info" element={<EnterprisePage />} />
          <Route path="enterprise/license" element={<EnterprisePage />} />
          <Route path="enterprise/theme" element={<EnterprisePage />} />
          <Route path="enterprise/language" element={<EnterprisePage />} />

          {/* System Settings Routes */}
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
          <Route path="system/secrets" element={<StoragePage />} />
          <Route path="system/announcement" element={<SystemConfigPage />} />
          <Route path="system/auditlog" element={<SystemConfigPage />} />
          <Route path="system/integration" element={<SystemIntegrationPage />} />
          <Route path="system/integration/:category" element={<SystemIntegrationPage />} />

          <Route
            path="*"
            element={
              <div style={{ padding: 48, textAlign: 'center', background: '#fff', borderRadius: 8 }}>
                <h3>该页面正在建设中...</h3>
                <p style={{ color: '#8c8c8c' }}>请访问工作台或左侧导航栏中的可用功能模块。</p>
              </div>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/v1/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/v1/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
