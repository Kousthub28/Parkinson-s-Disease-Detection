import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import Dashboard from './pages/Dashboard';
import NewTest from './pages/NewTest';
import History from './pages/History';
import Chatbot from './pages/Chatbot';
import Orders from './pages/Orders';
import Auth from './pages/Auth';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import Therapy from './pages/Therapy';
import ComprehensiveScreening from './pages/ComprehensiveScreening';
import NutritionPlanner from './pages/NutritionPlanner';
import Layout from './components/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoaderCircle } from 'lucide-react';

const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <LoaderCircle className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Auth />} />
          <Route 
            path="/dashboard" 
            element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/new-test" 
            element={<PrivateRoute><Layout><NewTest /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/history" 
            element={<PrivateRoute><Layout><History /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/chatbot" 
            element={<PrivateRoute><Layout><Chatbot /></Layout></PrivateRoute>} 
          />
           <Route 
            path="/orders" 
            element={<PrivateRoute><Layout><Orders /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/profile" 
            element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/therapy" 
            element={<PrivateRoute><Layout><Therapy /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/comprehensive-screening" 
            element={<PrivateRoute><Layout><ComprehensiveScreening /></Layout></PrivateRoute>} 
          />
          <Route 
            path="/nutrition-planner" 
            element={<PrivateRoute><Layout><NutritionPlanner /></Layout></PrivateRoute>} 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
