import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, roc_auc_score,confusion_matrix
import joblib
pd.set_option('display.max_columns', None)

df1=pd.read_csv("brisbanecbd-aq-2023.csv")
df2=pd.read_csv("brisbanecbd-aq-2024.csv")
df=pd.read_csv("brisbane_water_quality.csv")

df=df.drop('Record number',axis=1)

df['Timestamp']=pd.to_datetime(df['Timestamp'])
df = df.set_index('Timestamp')

quality_columns=['Chlorophyll [quality]','Temperature [quality]','Dissolved Oxygen [quality]','Dissolved Oxygen (%Saturation) [quality]','pH [quality]','Salinity [quality]','Specific Conductance [quality]','Turbidity [quality]']
numeric_columns = df.select_dtypes(include=['float64', 'int64']).columns
numeric_columns = [c for c in numeric_columns if c not in quality_columns]


mask = (df[quality_columns] == 1220).any(axis=1)
df = df[~mask]

df[quality_columns]=df[quality_columns].fillna(2)
df[quality_columns]=df[quality_columns].replace({
    1020:1,
    2010:0
})


numeric_hourly = df[numeric_columns].resample('1h').mean()  #converts every rows between an hour into a single by taking the mean 
quality_hourly = df[quality_columns].resample('1h').min()   #convert the timframes into single and choose the min value of entries in the rows between the hour
df_hourly = pd.concat([numeric_hourly, quality_hourly], axis=1) #new dataframe 

turbidity_max  = df['Turbidity'].resample('1h').max()


df1['Timestamp']=pd.to_datetime(df1['Date']+" "+df1['Time'], dayfirst=True) #if date has day first then converts into mm/dd/yy
df1=df1.set_index('Timestamp')

df2['Timestamp']=pd.to_datetime(df2['Date']+" "+df2['Time'],dayfirst=True)
df2=df2.set_index('Timestamp')

df1=df1.drop('Date',axis=1)
df1=df1.drop('Time',axis=1)
df2=df2.drop('Date',axis=1)
df2=df2.drop('Time',axis=1)

weather_df=pd.concat([df1,df2],axis=0)

merged_df=df_hourly.merge(
    weather_df,
    left_index=True,
    right_index=True,
    how='inner'       #keeps only those rows whose timestamps are in both files
)

#handling missing values
#Weather doesn’t jump randomly hour to hour.
#just having 2-3 missing values)
weather_columns=['Wind Direction (degTN)','Wind Speed (m/s)','Wind Sigma Theta (deg)','Wind Speed Std Dev (m/s)','Air Temperature (degC)','Relative Humidity (%)','Rainfall (mm)','Barometric Pressure (hPa)']

merged_df[weather_columns]=merged_df[weather_columns].ffill().bfill() #forward fill(fill with last known value),backward fill(fill with next known value)

merged_df[quality_columns] = merged_df[quality_columns].fillna(2)


water_columns=[
    'Average Water Speed',
    'Average Water Direction',
    'Chlorophyll',
    'Temperature',
    'Dissolved Oxygen',
    'Dissolved Oxygen (%Saturation)',
    'pH',
    'Salinity',
    'Specific Conductance',
    'Turbidity',
    'Turbidity_max'
]
merged_df[water_columns]=merged_df[water_columns].fillna(
    merged_df[water_columns].rolling(window=3,min_periods=1).mean() #take the avg of last 3 values,if only one is present then also do
    )


core_water_cols = [
    'pH',
    'Turbidity',
    'Dissolved Oxygen',
    'Temperature'
]
merged_df=merged_df.dropna(subset=core_water_cols)

merged_df['Rainfall_6H']=merged_df['Rainfall (mm)'].rolling(window=6).sum()
merged_df['Turbidity_delta_3h'] = merged_df['Turbidity'] - merged_df['Turbidity'].shift(3)     #.shift(3) gives the value 3index back
                                    

merged_df['Contamination_Risk']=( (merged_df['Turbidity']>5) |
                                  (merged_df['Turbidity_delta_3h']>2) | 
                                  (merged_df['Rainfall_6H']>10)
                                ).astype(int)    

#creating a label column which is 1 when turb>5 or change in turb in last 3 hour is >2 or total rainfall in last 6 hr>10

merged_df['Contamination_Risk_Future'] = ( 
    (merged_df['Contamination_Risk'].shift(-3))         #as contamination risk was true when turb>5 or rainfall>10 so
)                                                       #the model learned that and just checks the turbidity and rainfall and give perfect output
                                                        #so it was data leakage now we made the label of 3hrs ahead so the model
                                                        # will now predict that the risk of future
merged_df = merged_df.dropna(subset=['Contamination_Risk_Future'])

split_idx=int(len(merged_df)*0.7)
train=merged_df.iloc[:split_idx]
test=merged_df.iloc[split_idx:]

X_cols = [
    'Average Water Speed',
    'Average Water Direction',
    'Chlorophyll',
    'Temperature',
    'Dissolved Oxygen',
    'Dissolved Oxygen (%Saturation)',
    'pH',
    'Salinity',
    'Specific Conductance',
    'Turbidity',
    'Turbidity_max',
    'Rainfall (mm)',
    'Air Temperature (degC)',
    'Relative Humidity (%)',
    'Wind Speed (m/s)',
    'Rainfall_6H',
    'Turbidity_delta_3h'
]

X_train = train[X_cols]
y_train = train['Contamination_Risk_Future']

X_test = test[X_cols]
y_test = test['Contamination_Risk_Future']

scale_pos_weight = y_train.value_counts()[0] / y_train.value_counts()[1]
#This tells the model:
#“Missing a risk event is worse than a false alarm.”

model = XGBClassifier(
    n_estimators=300,
    max_depth=5,
    learning_rate=0.01,
    subsample=0.8,
    scale_pos_weight=scale_pos_weight,
    colsample_bytree=0.8,
    eval_metric='logloss'
    
)

model.fit(X_train, y_train)

joblib.dump(model, "xgb_water_model.pkl")

pred_default = model.predict(X_test)          # threshold = 0.5

prob=model.predict_proba(X_test)[:, 1]  #“Give me only the probability of class 1 (risk) for all samples.”
pred_custom  = (prob > 0.35).astype(int)     # threshold = 0.35  , 1 for prob greater than 0.35 and 0 for below

print("DEFAULT THRESHOLD (0.5)")
print(classification_report(y_test, pred_default)) #prob more than 0.5 is risk and in custom above .35

print("CUSTOM THRESHOLD (0.35)")
print(classification_report(y_test, pred_custom))

print(confusion_matrix(y_test,pred_custom))


importances = pd.Series(
    model.feature_importances_,
    index=X_cols
)
top_features = importances.sort_values(ascending=False).head(10)

plt.figure(figsize=(7,5))
plt.barh(top_features.index[::-1], top_features.values[::-1])

plt.title("Top 10 Feature Drivers of Contamination Risk")
plt.xlabel("Importance Score")

plt.tight_layout()
plt.show()

sns.scatterplot(x=merged_df.index,y=merged_df['Turbidity'],hue=merged_df['Turbidity']>5)
plt.show()