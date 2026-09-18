from app.models.aa_semantic import ValuedFactMixin, WindowMixin, fact_constraints
from app.models.base import Base


class AABaseline(ValuedFactMixin, WindowMixin, Base):
    __tablename__ = "aa_baselines"
    __table_args__ = fact_constraints(__tablename__, window=True)
