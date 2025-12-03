import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card,CardContent,CardHeader,CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Plus, CreditCard } from 'lucide-react';

interface Account {
  id: string;
  account_number: string;
  account_type: string;
  balance: number;
  currency: string;
  status: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch accounts from API
    // For now, using mock data
    setTimeout(() => {
      setAccounts([
        {
          id: '1',
          account_number: '1234567890',
          account_type: 'checking',
          balance: 5000.00,
          currency: 'USD',
          status: 'active'
        },
        {
          id: '2',
          account_number: '0987654321',
          account_type: 'savings',
          balance: 15000.00,
          currency: 'USD',
          status: 'active'
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Accounts</h1>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          New Account
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => (
          <Link key={account.id} to={`/accounts/${account.id}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  {account.account_type.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {account.account_number}
                </p>
                <p className="text-2xl font-bold">
                  {account.currency} {account.balance.toLocaleString()}
                </p>
                <p className="text-sm text-green-600 mt-2">
                  Status: {account.status}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}