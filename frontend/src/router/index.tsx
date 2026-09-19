import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import BasicLayout from '../layouts/BasicLayout';
import ProjectDetailLayout from '../layouts/ProjectDetailLayout';
import LoginPage from '../pages/Login';
import DashboardPage from '../pages/Dashboard';
import ProjectsPage from '../pages/Projects';
import ServicesPage from '../pages/Services';
import EnvironmentsPage from '../pages/Environments';
import PipelinesPage from '../pages/Pipelines';
import PipelineExecutionPage from '../pages/Pipelines/Execution';
import InsightsPage from '../pages/Insights';
import StatisticsPage from '../pages/Statistics';
import ClustersPage from '../pages/Settings/Clusters';
import CodeHostsPage from '../pages/Settings/CodeHosts';
import RegistriesPage from '../pages/Settings/Registries';
import StoragePage from '../pages/Settings/Storage';
import UsersPage from '../pages/Settings/Users';

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
        {/* Support both /signin and /login routes */}
        <Route path="/signin" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

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

          {/* Global Projects Overview */}
          <Route path="projects" element={<ProjectsPage />} />

          {/* Project-Scoped Workspace with Secondary Sub-Navigation */}
          <Route path="projects/detail/:projectName" element={<ProjectDetailLayout />}>
            <Route index element={<Navigate to="pipelines" replace />} />
            <Route path="pipelines" element={<PipelinesPage />} />
            <Route path="pipelines/:name/task/:taskId" element={<PipelineExecutionPage />} />
            <Route path="envs" element={<EnvironmentsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="sprints" element={<PipelinesPage />} />
            <Route path="builds" element={<PipelinesPage />} />
            <Route path="test" element={<PipelinesPage />} />
            <Route path="scanner" element={<PipelinesPage />} />
            <Route path="version" element={<PipelinesPage />} />
          </Route>

          {/* Global Release & Pipelines */}
          <Route path="pipelines" element={<PipelinesPage />} />
          <Route path="releaseWorkflow" element={<PipelinesPage />} />
          <Route path="pipelines/:name/task/:taskId" element={<PipelineExecutionPage />} />
          <Route path="releasePlan" element={<PipelinesPage />} />
          <Route path="plutus" element={<PipelinesPage />} />

          {/* Standalone Fallbacks for Services & Envs */}
          <Route path="services" element={<ServicesPage />} />
          <Route path="envs" element={<EnvironmentsPage />} />

          {/* Asset Management Routes */}
          <Route path="directory" element={<ProjectsPage />} />
          <Route path="template" element={<ProjectsPage />} />
          <Route path="tests" element={<PipelinesPage />} />
          <Route path="delivery" element={<PipelinesPage />} />
          <Route path="resource" element={<ClustersPage />} />

          {/* Insights & Statistics */}
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="insight" element={<InsightsPage />} />
          <Route path="insights" element={<InsightsPage />} />

          {/* System Settings Routes */}
          <Route path="system/clusters" element={<ClustersPage />} />
          <Route path="system/codehosts" element={<CodeHostsPage />} />
          <Route path="system/registries" element={<RegistriesPage />} />
          <Route path="system/storage" element={<StoragePage />} />
          <Route path="system/users" element={<UsersPage />} />
          <Route path="system/config" element={<ClustersPage />} />

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
