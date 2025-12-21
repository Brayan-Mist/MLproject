"""
УНИВЕРСАЛЬНЫЙ ШАБЛОН ДЛЯ МАШИННОГО ОБУЧЕНИЯ
===========================================
Просто измените параметры в разделе КОНФИГУРАЦИЯ
и запустите программу!
Версия: PyTorch
"""

import yaml
import wandb
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import matplotlib.pyplot as plt
import os
import pickle

# Проверка доступности GPU
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Используемое устройство: {device}")

if torch.cuda.is_available():
    print(f"Доступные GPU: {torch.cuda.device_count()}")
    for i in range(torch.cuda.device_count()):
        print(f"  GPU {i}: {torch.cuda.get_device_name(i)}")
    
    # Выбор конкретной видеокарты (например, вторая - индекс 1)
    if torch.cuda.device_count() > 1:
        torch.cuda.set_device(1)
        print(f"Выбрана видеокарта: {torch.cuda.get_device_name(1)}")

# ============================================
# 🔧 КОНФИГУРАЦИЯ - НАСТРОЙТЕ ПОД СВОЮ ЗАДАЧУ
# ============================================

def load_config(config_path="config.yaml"):
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

CONFIG = load_config()

wandb.init(
    project="universal_model_pytorch",
    config=CONFIG
)

# ============================================
# 📊 ФУНКЦИЯ ГЕНЕРАЦИИ ДАННЫХ - ИЗМЕНИТЕ ПОД СВОЮ ЗАДАЧУ
# ============================================

def generate_data(n_samples):
    """
    🔥 ИЗМЕНИТЕ ЭТУ ФУНКЦИЮ ПОД СВОИ ДАННЫЕ!
    
    Примеры:
    1. Сумма: y = x1 + x2
    2. Произведение: y = x1 * x2
    3. Квадрат: y = x1**2 + x2**2
    4. Синус: y = np.sin(x1) + np.cos(x2)
    5. Или загрузите CSV: pd.read_csv('data.csv')
    """
    # ПРИМЕР 1: Сумма двух чисел
    X = np.random.randint(0, 10, size=(n_samples, 2))
    y = X[:, 0] + X[:, 1]
    
    # ПРИМЕР 2: Произведение (раскомментируйте для использования)
    # X = np.random.rand(n_samples, 2) * 10
    # y = X[:, 0] * X[:, 1]
    
    # ПРИМЕР 3: Нелинейная зависимость
    # X = np.random.rand(n_samples, 2) * 10
    # y = X[:, 0]**2 + np.sin(X[:, 1]) * 5
    
    # ПРИМЕР 4: Загрузка из CSV
    # import pandas as pd
    # data = pd.read_csv('your_data.csv')
    # X = data[['feature1', 'feature2']].values
    # y = data['target'].values
    
    return X, y

# ============================================
# 🧪 ФУНКЦИЯ ТЕСТИРОВАНИЯ - ИЗМЕНИТЕ ПОД СВОЮ ЗАДАЧУ
# ============================================

def calculate_expected(input_data):
    """
    Вычисляет ожидаемый результат для сравнения
    ИЗМЕНИТЕ под вашу функцию!
    """
    # Для суммы:
    return input_data[0] + input_data[1]
    
    # Для произведения:
    # return input_data[0] * input_data[1]
    
    # Для других функций:
    # return input_data[0]**2 + np.sin(input_data[1]) * 5

# ============================================
# 🏗️ ОСНОВНОЙ КОД - НЕ ТРОГАЙТЕ, ЕСЛИ НЕ УВЕРЕНЫ
# ============================================

# Фиксируем случайность
torch.manual_seed(CONFIG['random_state'])
np.random.seed(CONFIG['random_state'])
if torch.cuda.is_available():
    torch.cuda.manual_seed(CONFIG['random_state'])

# Пути для сохранения
MODEL_PATH = f"{CONFIG['model_name']}_pytorch.pth"
SCALER_PATH = f"{CONFIG['model_name']}_scaler.pkl"
PLOT_PATH = f"{CONFIG['model_name']}_training.png"

# ============================================
# 🧠 ОПРЕДЕЛЕНИЕ МОДЕЛИ
# ============================================

class NeuralNetwork(nn.Module):
    def __init__(self, input_size, layers, activation, dropout_rate, output_units, output_activation):
        super(NeuralNetwork, self).__init__()
        
        # Выбор функции активации
        activation_dict = {
            'relu': nn.ReLU(),
            'tanh': nn.Tanh(),
            'sigmoid': nn.Sigmoid()
        }
        self.activation = activation_dict.get(activation, nn.ReLU())
        
        # Создание слоев
        self.layers_list = nn.ModuleList()
        
        # Первый слой
        self.layers_list.append(nn.Linear(input_size, layers[0]))
        self.layers_list.append(self.activation)
        if dropout_rate > 0:
            self.layers_list.append(nn.Dropout(dropout_rate))
        
        # Скрытые слои
        for i in range(len(layers) - 1):
            self.layers_list.append(nn.Linear(layers[i], layers[i+1]))
            self.layers_list.append(self.activation)
            if dropout_rate > 0:
                self.layers_list.append(nn.Dropout(dropout_rate))
        
        # Выходной слой
        self.output_layer = nn.Linear(layers[-1], output_units)
        
        # Выходная активация
        if output_activation == 'softmax':
            self.output_activation = nn.Softmax(dim=1)
        elif output_activation == 'sigmoid':
            self.output_activation = nn.Sigmoid()
        else:
            self.output_activation = None
    
    def forward(self, x):
        for layer in self.layers_list:
            x = layer(x)
        x = self.output_layer(x)
        if self.output_activation:
            x = self.output_activation(x)
        return x

# ============================================
# 📈 КЛАСС ДЛЯ EARLY STOPPING
# ============================================

class EarlyStopping:
    def __init__(self, patience=15, min_delta=0):
        self.patience = patience
        self.min_delta = min_delta
        self.counter = 0
        self.best_loss = None
        self.early_stop = False
        self.best_model = None
        self.stop_reason = None
    
    def __call__(self, val_loss, model, current_mae=None, current_accuracy=None):
        # Проверка достижения целевых метрик
        if CONFIG.get('target_loss') is not None and val_loss <= CONFIG['target_loss']:
            self.early_stop = True
            self.stop_reason = f"Достигнута целевая Loss: {val_loss:.6f} <= {CONFIG['target_loss']}"
            self.best_model = model.state_dict().copy()
            return
        
        if CONFIG.get('target_mae') is not None and current_mae is not None:
            if current_mae <= CONFIG['target_mae']:
                self.early_stop = True
                self.stop_reason = f"Достигнута целевая MAE: {current_mae:.6f} <= {CONFIG['target_mae']}"
                self.best_model = model.state_dict().copy()
                return
        
        if CONFIG.get('target_accuracy') is not None and current_accuracy is not None:
            if current_accuracy >= CONFIG['target_accuracy']:
                self.early_stop = True
                self.stop_reason = f"Достигнута целевая Accuracy: {current_accuracy:.4f} >= {CONFIG['target_accuracy']}"
                self.best_model = model.state_dict().copy()
                return
        
        # Стандартная логика Early Stopping
        if self.best_loss is None:
            self.best_loss = val_loss
            self.best_model = model.state_dict().copy()
        elif val_loss > self.best_loss - self.min_delta:
            self.counter += 1
            if self.counter >= self.patience:
                self.early_stop = True
                self.stop_reason = f"Early stopping: нет улучшений {self.patience} эпох"
        else:
            # Проверка минимального улучшения
            improvement = self.best_loss - val_loss
            if improvement < CONFIG.get('min_improvement', 0):
                self.counter += 1
                if self.counter >= self.patience:
                    self.early_stop = True
                    self.stop_reason = f"Early stopping: улучшение < {CONFIG.get('min_improvement', 0)}"
            else:
                self.best_loss = val_loss
                self.best_model = model.state_dict().copy()
                self.counter = 0

# ============================================
# 🎓 ФУНКЦИЯ ОБУЧЕНИЯ
# ============================================

def train_new_model():
    """Обучение новой модели"""
    print("\n" + "="*60)
    print("📊 ГЕНЕРАЦИЯ ДАННЫХ")
    print("="*60)
    
    X, y = generate_data(CONFIG['n_samples'])
    
    print(f"✓ Создано {CONFIG['n_samples']} примеров")
    print(f"✓ Форма X: {X.shape}, Форма y: {y.shape}")
    print(f"\nПримеры данных:")
    for i in range(min(5, len(X))):
        print(f"  {X[i]} -> {y[i]}")
    
    # Разделение данных
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=CONFIG['test_size'], random_state=CONFIG['random_state']
    )
    
    # Нормализация
    if CONFIG['normalize']:
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
    else:
        scaler = None
        X_train_scaled = X_train
        X_test_scaled = X_test
    
    print(f"\n✓ Train: {X_train.shape}, Test: {X_test.shape}")
    
    # Конвертация в тензоры PyTorch
    X_train_tensor = torch.FloatTensor(X_train_scaled).to(device)
    y_train_tensor = torch.FloatTensor(y_train.reshape(-1, 1)).to(device)
    X_test_tensor = torch.FloatTensor(X_test_scaled).to(device)
    y_test_tensor = torch.FloatTensor(y_test.reshape(-1, 1)).to(device)
    
    # Создание DataLoader
    train_dataset = TensorDataset(X_train_tensor, y_train_tensor)
    test_dataset = TensorDataset(X_test_tensor, y_test_tensor)
    
    train_loader = DataLoader(train_dataset, batch_size=CONFIG['batch_size'], shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=CONFIG['batch_size'], shuffle=False)
    
    # Создание модели
    print("\n" + "="*60)
    print("🏗️ СОЗДАНИЕ МОДЕЛИ")
    print("="*60)
    
    model = NeuralNetwork(
        input_size=X.shape[1],
        layers=CONFIG['layers'],
        activation=CONFIG['activation'],
        dropout_rate=CONFIG['dropout_rate'],
        output_units=CONFIG['output_units'],
        output_activation=CONFIG['output_activation']
    ).to(device)
    
    print(model)
    print(f"\nВсего параметров: {sum(p.numel() for p in model.parameters())}")
    
    # Определение функции потерь
    if CONFIG['loss'] == 'mse':
        criterion = nn.MSELoss()
    elif CONFIG['loss'] == 'mae':
        criterion = nn.L1Loss()
    elif CONFIG['loss'] == 'cross_entropy':
        criterion = nn.CrossEntropyLoss()
    else:
        criterion = nn.MSELoss()
    
    # Определение оптимизатора
    if CONFIG['optimizer'] == 'adam':
        optimizer = optim.Adam(model.parameters(), lr=CONFIG['learning_rate'])
    elif CONFIG['optimizer'] == 'sgd':
        optimizer = optim.SGD(model.parameters(), lr=CONFIG['learning_rate'])
    elif CONFIG['optimizer'] == 'rmsprop':
        optimizer = optim.RMSprop(model.parameters(), lr=CONFIG['learning_rate'])
    else:
        optimizer = optim.Adam(model.parameters(), lr=CONFIG['learning_rate'])
    
    # Обучение
    print("\n" + "="*60)
    print("🚀 ОБУЧЕНИЕ МОДЕЛИ")
    print("="*60)
    
    early_stopping = EarlyStopping(patience=CONFIG['early_stopping_patience'])
    history = {'loss': [], 'val_loss': [], 'mae': [], 'val_mae': []}
    
    for epoch in range(CONFIG['epochs']):
        # Фаза обучения
        model.train()
        train_loss = 0.0
        train_mae = 0.0
        
        for batch_X, batch_y in train_loader:
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item() * batch_X.size(0)
            train_mae += torch.mean(torch.abs(outputs - batch_y)).item() * batch_X.size(0)
        
        train_loss /= len(train_loader.dataset)
        train_mae /= len(train_loader.dataset)
        
        # Фаза валидации
        model.eval()
        val_loss = 0.0
        val_mae = 0.0
        
        with torch.no_grad():
            for batch_X, batch_y in test_loader:
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                
                val_loss += loss.item() * batch_X.size(0)
                val_mae += torch.mean(torch.abs(outputs - batch_y)).item() * batch_X.size(0)
        
        val_loss /= len(test_loader.dataset)
        val_mae /= len(test_loader.dataset)
        
        # Сохранение истории
        history['loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['mae'].append(train_mae)
        history['val_mae'].append(val_mae)
        
        # Логирование в WandB
        wandb.log({
            'epoch': epoch,
            'loss': train_loss,
            'val_loss': val_loss,
            'mae': train_mae,
            'val_mae': val_mae
        })
        
        # Вывод прогресса
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch {epoch+1}/{CONFIG['epochs']} - "
                  f"Loss: {train_loss:.4f} - Val Loss: {val_loss:.4f} - "
                  f"MAE: {train_mae:.4f} - Val MAE: {val_mae:.4f}")
        
        # Early stopping
        early_stopping(val_loss, model, current_mae=val_mae)
        if early_stopping.early_stop:
            print(f"\n✓ {early_stopping.stop_reason} на эпохе {epoch+1}")
            model.load_state_dict(early_stopping.best_model)
            break
    
    print("\n✓ Обучение завершено!")
    
    # Оценка
    print("\n" + "="*60)
    print("📈 ОЦЕНКА МОДЕЛИ")
    print("="*60)
    
    model.eval()
    with torch.no_grad():
        train_outputs = model(X_train_tensor)
        test_outputs = model(X_test_tensor)
        
        train_loss = criterion(train_outputs, y_train_tensor).item()
        test_loss = criterion(test_outputs, y_test_tensor).item()
        
        train_mae = torch.mean(torch.abs(train_outputs - y_train_tensor)).item()
        test_mae = torch.mean(torch.abs(test_outputs - y_test_tensor)).item()
    
    print(f"Train Loss: {train_loss:.4f}")
    print(f"Test Loss:  {test_loss:.4f}")
    print(f"Train MAE: {train_mae:.4f}")
    print(f"Test MAE:  {test_mae:.4f}")
    
    # Визуализация
    plot_training(history)
    
    # Сохранение
    print("\n💾 Сохранение модели...")
    torch.save({
        'model_state_dict': model.state_dict(),
        'config': CONFIG,
        'input_size': X.shape[1]
    }, MODEL_PATH)
    
    if scaler:
        with open(SCALER_PATH, 'wb') as f:
            pickle.dump(scaler, f)
    
    print(f"✓ Модель: {MODEL_PATH}")
    print(f"✓ Scaler: {SCALER_PATH}")
    print(f"✓ График: {PLOT_PATH}")
    
    return model, scaler

def plot_training(history):
    """Визуализация процесса обучения"""
    
    # Вывод статуса GPU
    if torch.cuda.is_available():
        print(f"\n📊 Статус GPU:")
        print(f"  Память занята: {torch.cuda.memory_allocated()/1024**2:.0f}MB")
        print(f"  Максимум памяти: {torch.cuda.max_memory_allocated()/1024**2:.0f}MB")
    
    plt.figure(figsize=(12, 4))
    
    # Loss
    plt.subplot(1, 2, 1)
    plt.plot(history['loss'], label='Train Loss')
    plt.plot(history['val_loss'], label='Val Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.title('Training Loss')
    plt.legend()
    plt.grid(True)
    
    # MAE
    plt.subplot(1, 2, 2)
    plt.plot(history['mae'], label='Train MAE')
    plt.plot(history['val_mae'], label='Val MAE')
    plt.xlabel('Epoch')
    plt.ylabel('MAE')
    plt.title('Training MAE')
    plt.legend()
    plt.grid(True)
    
    plt.tight_layout()
    plt.savefig(PLOT_PATH)
    print(f"✓ График сохранён: {PLOT_PATH}")

# ============================================
# 🎮 ГЛАВНОЕ МЕНЮ
# ============================================

print("="*60)
print(f"🤖 УНИВЕРСАЛЬНЫЙ ML ШАБЛОН (PyTorch)")
print(f"   Модель: {CONFIG['model_name']}")
print("="*60)

model_exists = os.path.exists(MODEL_PATH)

if model_exists:
    print("\n✓ Найдена сохранённая модель!")
    print("\nВыберите режим:")
    print("1 - Загрузить существующую модель")
    print("2 - Обучить новую модель")
    choice = input("\nВаш выбор (1/2): ").strip()
    
    if choice == '1':
        print("\n📥 Загружаю модель...")
        checkpoint = torch.load(MODEL_PATH, map_location=device)
        
        model = NeuralNetwork(
            input_size=checkpoint['input_size'],
            layers=checkpoint['config']['layers'],
            activation=checkpoint['config']['activation'],
            dropout_rate=checkpoint['config']['dropout_rate'],
            output_units=checkpoint['config']['output_units'],
            output_activation=checkpoint['config']['output_activation']
        ).to(device)
        
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        
        if CONFIG['normalize'] and os.path.exists(SCALER_PATH):
            with open(SCALER_PATH, 'rb') as f:
                scaler = pickle.load(f)
        else:
            scaler = None
        
        print("✓ Модель загружена!")
        print(model)
    else:
        model, scaler = train_new_model()
else:
    print("\n⚠ Сохранённая модель не найдена.")
    print("Будет обучена новая модель.\n")
    model, scaler = train_new_model()

# ============================================
# 🧪 ИНТЕРАКТИВНОЕ ТЕСТИРОВАНИЕ
# ============================================

print("\n" + "="*60)
print("🎯 РЕЖИМ ТЕСТИРОВАНИЯ")
print("="*60)
print("Команды:")
print("  • Введите числа через пробел для предсказания")
print("  • 'config' - показать конфигурацию")
print("  • 'test' - автоматический тест")
print("  • 'exit' - выход")
print("="*60 + "\n")

model.eval()

while True:
    try:
        user_input = input(">>> ").strip()
        
        if user_input.lower() == 'exit':
            print("👋 До свидания!")
            break
        
        elif user_input.lower() == 'config':
            print("\n⚙️ КОНФИГУРАЦИЯ:")
            print("="*60)
            for key, value in CONFIG.items():
                print(f"  {key:.<30} {value}")
            print("="*60 + "\n")
            continue
        
        elif user_input.lower() == 'test':
            print("\n🧪 АВТОМАТИЧЕСКИЙ ТЕСТ:")
            print("="*60)
            
            # Генерируем тестовые данные
            test_X, test_y = generate_data(5)
            
            for i, numbers in enumerate(test_X):
                test_data = np.array([numbers])
                if scaler:
                    test_data = scaler.transform(test_data)
                
                test_tensor = torch.FloatTensor(test_data).to(device)
                
                with torch.no_grad():
                    prediction = model(test_tensor).cpu().numpy()[0]
                
                if CONFIG['output_units'] == 1:
                    prediction = prediction[0]
                
                expected = calculate_expected(numbers)
                error = abs(prediction - expected)
                
                status = "✓" if error < 1 else "✗"
                print(f"{status} {numbers} -> {expected:.2f} | "
                      f"Предсказано: {prediction:.2f} | Ошибка: {error:.2f}")
            print("="*60 + "\n")
            continue
        
        # Обработка входных данных
        numbers = list(map(float, user_input.split()))
        
        if len(numbers) != CONFIG.get('input_features', 2):
            print(f"❌ Ошибка: введите {CONFIG.get('input_features', 2)} числа!\n")
            continue
        
        # Предсказание
        test_data = np.array([numbers])
        if scaler:
            test_data = scaler.transform(test_data)
        
        test_tensor = torch.FloatTensor(test_data).to(device)
        
        with torch.no_grad():
            prediction = model(test_tensor).cpu().numpy()[0]
        
        if CONFIG['output_units'] == 1:
            prediction = prediction[0]
        
        expected = calculate_expected(numbers)
        error = abs(prediction - expected)
        
        print(f"\n  📊 Результат:")
        print(f"  ├─ Входные данные: {numbers}")
        print(f"  ├─ Предсказание:   {prediction:.2f}")
        print(f"  ├─ Ожидалось:      {expected:.2f}")
        print(f"  └─ Ошибка:         {error:.2f}")
        
        if error < 0.5:
            print("  ✓ Отличное предсказание! 🎯\n")
        elif error < 1.0:
            print("  ✓ Хорошее предсказание! ✅\n")
        else:
            print("  ⚠ Есть ошибка... 🤔\n")
        
    except ValueError:
        print("❌ Ошибка: введите корректные числа!\n")
    except KeyboardInterrupt:
        print("\n\n👋 Программа прервана!")
        break
    except Exception as e:
        print(f"❌ Ошибка: {e}\n")

wandb.finish()