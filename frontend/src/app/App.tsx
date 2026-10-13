import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { LoadingBlock } from '../components/ui/Feedback'
import { ToastProvider } from '../components/ui/Toast'
import { AuthProvider } from '../features/auth/AuthContext'
import { LoginPage } from '../features/auth/LoginPage'
import { ForgotPasswordPage, ResetPasswordPage } from '../features/auth/PasswordRecoveryPages'
import { RequireRole } from '../features/auth/RequireRole'
import { NotFoundPage, UnauthorizedPage } from '../features/auth/StatusPages'
import { LandingPage } from '../features/landing/LandingPage'
import { ThemeProvider } from '../features/theme/ThemeContext'

/** Lazy-load a named export so each area is split into its own chunk. */
function page<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}

const AdminLayout = page(() => import('../layouts/AdminLayout'), 'AdminLayout')
const EmployeeLayout = page(() => import('../layouts/EmployeeLayout'), 'EmployeeLayout')

const DashboardPage = page(() => import('../features/admin/DashboardPage'), 'DashboardPage')
const EmployeesPage = page(() => import('../features/admin/employees/EmployeesPage'), 'EmployeesPage')
const EmployeeFormPage = page(() => import('../features/admin/employees/EmployeeFormPage'), 'EmployeeFormPage')
const EmployeeDetailPage = page(() => import('../features/admin/employees/EmployeeDetailPage'), 'EmployeeDetailPage')
const EnrollmentPage = page(() => import('../features/admin/employees/EnrollmentPage'), 'EnrollmentPage')
const AttendancePage = page(() => import('../features/admin/attendance/AttendancePage'), 'AttendancePage')
const AttendanceDetailPage = page(() => import('../features/admin/attendance/AttendanceDetailPage'), 'AttendanceDetailPage')
const cameras = () => import('../features/admin/cameras/CameraPages')
const CamerasPage = page(cameras, 'CamerasPage')
const CameraNewPage = page(cameras, 'CameraNewPage')
const CameraDetailPage = page(cameras, 'CameraDetailPage')
const ReportsPage = page(() => import('../features/admin/ReportsPage'), 'ReportsPage')
const ReviewsPage = page(() => import('../features/admin/ReviewsPage'), 'ReviewsPage')
const AuditLogsPage = page(() => import('../features/admin/AuditLogsPage'), 'AuditLogsPage')
const SettingsLayout = page(() => import('../features/admin/settings/SettingsLayout'), 'SettingsLayout')
const settings = () => import('../features/admin/settings/SettingsPages')
const SettingsIndexPage = page(settings, 'SettingsIndexPage')
const AccountSettingsPage = page(settings, 'AccountSettingsPage')
const SecuritySettingsPage = page(settings, 'SecuritySettingsPage')
const AttendanceSettingsPage = page(settings, 'AttendanceSettingsPage')
const PrivacySettingsPage = page(settings, 'PrivacySettingsPage')
const RetentionSettingsPage = page(settings, 'RetentionSettingsPage')
const BackupSettingsPage = page(settings, 'BackupSettingsPage')
const SystemSettingsPage = page(settings, 'SystemSettingsPage')

const employee = () => import('../features/employee/EmployeePages')
const EmployeeDashboardPage = page(employee, 'EmployeeDashboardPage')
const MyAttendancePage = page(employee, 'MyAttendancePage')
const MyAttendanceDetailPage = page(employee, 'MyAttendanceDetailPage')
const ProfilePage = page(employee, 'ProfilePage')
const EmployeeSettingsPage = page(employee, 'EmployeeSettingsPage')
const EmployeeSecurityPage = page(employee, 'EmployeeSecurityPage')
const CorrectionRequestsPage = page(employee, 'CorrectionRequestsPage')

function AdminOnly({ children }: { children: React.ReactNode }) {
  return <RequireRole roles={['admin']}>{children}</RequireRole>
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <Suspense fallback={<LoadingBlock />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                <Route
                  path="/admin"
                  element={
                    <RequireRole roles={['admin', 'operator']}>
                      <AdminLayout />
                    </RequireRole>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="employees" element={<EmployeesPage />} />
                  <Route path="employees/new" element={<AdminOnly><EmployeeFormPage /></AdminOnly>} />
                  <Route path="employees/:id" element={<EmployeeDetailPage />} />
                  <Route path="employees/:id/edit" element={<AdminOnly><EmployeeFormPage /></AdminOnly>} />
                  <Route path="employees/:id/enrollment" element={<AdminOnly><EnrollmentPage /></AdminOnly>} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="attendance/:id" element={<AttendanceDetailPage />} />
                  <Route path="cameras" element={<CamerasPage />} />
                  <Route path="cameras/new" element={<AdminOnly><CameraNewPage /></AdminOnly>} />
                  <Route path="cameras/:id" element={<CameraDetailPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="reviews" element={<ReviewsPage />} />
                  <Route path="audit-logs" element={<AdminOnly><AuditLogsPage /></AdminOnly>} />
                  <Route path="settings" element={<SettingsIndexPage />} />
                  <Route path="settings" element={<SettingsLayout />}>
                    <Route path="account" element={<AccountSettingsPage />} />
                    <Route path="security" element={<SecuritySettingsPage />} />
                    <Route path="attendance" element={<AdminOnly><AttendanceSettingsPage /></AdminOnly>} />
                    <Route path="privacy" element={<AdminOnly><PrivacySettingsPage /></AdminOnly>} />
                    <Route path="retention" element={<AdminOnly><RetentionSettingsPage /></AdminOnly>} />
                    <Route path="backup" element={<AdminOnly><BackupSettingsPage /></AdminOnly>} />
                    <Route path="system" element={<SystemSettingsPage />} />
                  </Route>
                </Route>

                <Route
                  path="/employee"
                  element={
                    <RequireRole roles={['employee']}>
                      <EmployeeLayout />
                    </RequireRole>
                  }
                >
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<EmployeeDashboardPage />} />
                  <Route path="attendance" element={<MyAttendancePage />} />
                  <Route path="attendance/:id" element={<MyAttendanceDetailPage />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="settings" element={<EmployeeSettingsPage />} />
                  <Route path="security" element={<EmployeeSecurityPage />} />
                  <Route path="correction-requests" element={<CorrectionRequestsPage />} />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
