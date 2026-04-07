from app.schemas.reports import OverviewReport
from app.schemas.scenarios import ScenarioInput, ScenarioMonth, ScenarioResult


def project_scenario(overview: OverviewReport, payload: ScenarioInput) -> ScenarioResult:
    balance = overview.liquid_balance
    net_worth = overview.net_worth
    monthly_income = overview.monthly_income + payload.monthly_income_delta
    monthly_expenses = max(overview.monthly_expenses + payload.discretionary_spend_delta, 0)
    monthly_recurring = overview.recurring_burden_pct / 100 * overview.monthly_income + payload.recurring_delta
    months: list[ScenarioMonth] = []
    deficit_months = 0
    for month_index in range(1, payload.months + 1):
        balance = balance + monthly_income - monthly_expenses - monthly_recurring - payload.monthly_contribution_delta
        asset_growth = max(net_worth, 0) * payload.monthly_asset_growth_rate / 100
        net_worth = net_worth + monthly_income - monthly_expenses - monthly_recurring + asset_growth
        risk_flag = balance < 0
        if risk_flag:
            deficit_months += 1
        months.append(
            ScenarioMonth(
                month_index=month_index,
                balance=round(balance, 2),
                net_worth=round(net_worth, 2),
                goal_buffer=round(max(monthly_income - monthly_expenses - monthly_recurring, 0), 2),
                risk_flag=risk_flag,
            )
        )
    return ScenarioResult(name=payload.name, months=months, projected_goal_date=None, deficit_months=deficit_months)
