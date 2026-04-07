import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { CreateDrawer } from "../components/CreateDrawer";
import { MOBILE_PRIMARY_ROUTES } from "../lib/catalog";
import { presentNotification } from "../lib/notifications";
import { useCurrentUser, useLogoutMutation, useNotifications } from "../lib/query";

const NAV_ITEMS: Array<{ to: string; label: string; adminOnly?: boolean }> = [
  { to: "/", label: "Сводка" },
  { to: "/accounts", label: "Счета" },
  { to: "/operations", label: "Операции" },
  { to: "/budgets", label: "Бюджет" },
  { to: "/assets", label: "Активы" },
  { to: "/deposits", label: "Вклады" },
  { to: "/goals", label: "Цели" },
  { to: "/recurring", label: "Регулярные" },
  { to: "/reports", label: "Отчёты" },
  { to: "/scenarios", label: "Сценарии" },
  { to: "/settings", label: "Настройки" },
  { to: "/admin", label: "Админ", adminOnly: true }
];

const CREATE_SECTIONS = {
  "/accounts": "account",
  "/operations": "operation",
  "/budgets": "budget",
  "/assets": "asset",
  "/deposits": "deposit",
  "/goals": "goal",
  "/recurring": "recurring"
} as const;

export function AppShell() {
  const location = useLocation();
  const userQuery = useCurrentUser();
  const logoutMutation = useLogoutMutation();
  const notificationsQuery = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);
  const unreadCount = notificationsQuery.data?.filter((item) => !item.is_read).length ?? 0;
  const currentCreateSection =
    CREATE_SECTIONS[location.pathname as keyof typeof CREATE_SECTIONS] ?? null;
  const user = userQuery.data;
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin");
  const notificationItems = (notificationsQuery.data ?? []).slice(0, 5);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">AF</div>
          <div>
            <strong>AssetFlow</strong>
            <p>Личная финансовая система</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNavItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link key={item.to} to={item.to} className={`nav-link ${active ? "active" : ""}`}>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-actions">
            {currentCreateSection ? (
              <button type="button" className="primary-button" onClick={() => setCreateOpen(true)}>
                Добавить
              </button>
            ) : null}
            <div className="notification-wrap" ref={notificationRef}>
              <button
                type="button"
                className="icon-button"
                aria-label="Уведомления"
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3.75a4.25 4.25 0 0 0-4.25 4.25v1.03c0 .84-.2 1.67-.58 2.42l-.8 1.6A1.75 1.75 0 0 0 7.93 15.5h8.14a1.75 1.75 0 0 0 1.56-2.45l-.8-1.6a5.42 5.42 0 0 1-.58-2.42V8A4.25 4.25 0 0 0 12 3.75Zm0 16.5a2.61 2.61 0 0 0 2.38-1.55H9.62A2.61 2.61 0 0 0 12 20.25Z"
                    fill="currentColor"
                  />
                </svg>
                {unreadCount > 0 ? <span className="icon-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
              </button>
              {notificationsOpen ? (
                <div className="notification-popover morph-popover">
                  <div className="notification-popover-head">
                    <strong>Уведомления</strong>
                    <Link to="/notifications" className="text-link" onClick={() => setNotificationsOpen(false)}>
                      Все
                    </Link>
                  </div>
                  <div className="notification-popover-list">
                    {notificationItems.length ? (
                      notificationItems.map((item) => {
                        const view = presentNotification(item);
                        return (
                          <Link
                            key={item.id}
                            to="/notifications"
                            className="notification-popover-item"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <div className="inline-metrics">
                              <strong>{view.title}</strong>
                              {!item.is_read ? <span className="dot-indicator" /> : null}
                            </div>
                            <p>{view.body}</p>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="notification-popover-empty">Пока ничего нового.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            {user ? (
              <div className="profile-wrap" ref={profileRef}>
                <button
                  type="button"
                  className="avatar-button"
                  aria-label="Профиль"
                  onClick={() => setProfileOpen((value) => !value)}
                >
                  <div className="avatar-badge">{user.full_name.slice(0, 1).toUpperCase()}</div>
                </button>
                {profileOpen ? (
                  <div className="profile-popover morph-popover">
                    <div className="profile-popover-head">
                      <div className="avatar-badge">{user.full_name.slice(0, 1).toUpperCase()}</div>
                      <div>
                        <strong>{user.full_name}</strong>
                        <p>{user.email}</p>
                      </div>
                    </div>
                    <div className="stack-list">
                      <Link to="/settings" className="notification-popover-item" onClick={() => setProfileOpen(false)}>
                        <strong>Настройки</strong>
                        <p>{user.base_currency} · {user.timezone}</p>
                      </Link>
                      <button
                        type="button"
                        className="notification-popover-item profile-action"
                        onClick={() => logoutMutation.mutate()}
                        disabled={logoutMutation.isPending}
                      >
                        <strong>Выйти</strong>
                        <p>Завершить текущую сессию</p>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>

        <nav className="mobile-nav">
          {MOBILE_PRIMARY_ROUTES.map((route) => {
            const item = visibleNavItems.find((navItem) => navItem.to === route);
            if (!item) return null;
            return (
              <Link key={item.to} to={item.to} className={`mobile-link ${location.pathname === item.to ? "active" : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <CreateDrawer
        open={createOpen}
        section={currentCreateSection}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
