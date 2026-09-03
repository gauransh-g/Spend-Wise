from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.models.models import User, Account, Category
from app.schemas.schemas import UserCreate, UserOut, UserUpdate, Token, AccountCreate

router = APIRouter(prefix="/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=Token)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        currency=user_in.currency or "INR"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Seed default account & system categories
    default_acc = Account(user_id=user.id, name="Primary Savings", account_type="savings", balance=0.0, currency=user.currency)
    db.add(default_acc)

    default_cats = [
        Category(user_id=user.id, name="Food", icon="Utensils", color="#f59e0b", is_system=True),
        Category(user_id=user.id, name="Shopping", icon="ShoppingBag", color="#ec4899", is_system=True),
        Category(user_id=user.id, name="Transport", icon="Car", color="#3b82f6", is_system=True),
        Category(user_id=user.id, name="Entertainment", icon="Film", color="#8b5cf6", is_system=True),
        Category(user_id=user.id, name="Bills", icon="Receipt", color="#ef4444", is_system=True),
        Category(user_id=user.id, name="Healthcare", icon="HeartPulse", color="#10b981", is_system=True),
        Category(user_id=user.id, name="Income", icon="DollarSign", color="#22c55e", is_system=True),
        Category(user_id=user.id, name="Other", icon="Tag", color="#6b7280", is_system=True),
    ]
    for c in default_cats:
        db.add(c)
    db.commit()

    token = create_access_token(subject=user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.post("/token", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    token = create_access_token(subject=user.id)
    return {"access_token": token, "token_type": "bearer", "user": user}

@router.get("/me", response_model=UserOut)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/me", response_model=UserOut)
def update_me(payload: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.full_name is not None and payload.full_name.strip():
        current_user.full_name = payload.full_name.strip()
    if payload.currency is not None:
        current_user.currency = payload.currency
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
