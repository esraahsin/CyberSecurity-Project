import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card,CardContent,CardHeader,CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function AccountDetailPage() {
  const { id } = useParams();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch account details from API
    setTimeout(() => {
      setAccount({
        id,
        account_number: '1234567890',
        account_type: 'checking',
        balance: 5000.00,
        currency: 'USD',
        status: 'active'
      });
      setLoading(false);
    }, 500);
  }, [id]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!account) {
    return <div>Account not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Account Details</h1>
        <div className="space-x-2">
          <Button variant="outline">
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            Deposit
          </Button>
          <Button>
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Transfer
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{account.account_type.toUpperCase()} Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Account Number</p>
            <p className="text-lg font-medium">{account.account_number}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Balance</p>
            <p className="text-3xl font-bold">
              {account.currency} {account.balance.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-medium text-green-600">{account.status}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No transactions yet</p>
        </CardContent>
      </Card>
    </div>
  );
}