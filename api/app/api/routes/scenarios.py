from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import User
from app.schemas.scenarios import ScenarioInput, ScenarioResult
from app.services.analytics import compute_overview
from app.services.scenarios import project_scenario

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("/project", response_model=ScenarioResult)
def project(
    payload: ScenarioInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ScenarioResult:
    overview = compute_overview(db, user.id)
    return project_scenario(overview, payload)
