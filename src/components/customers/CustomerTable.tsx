import { User, Eye, MessageCircle, Edit, Trash2 } from 'lucide-react';
import { Customer } from '../../types';
import { formatAppDate } from '../../lib/dateUtils';
import { formatCurrency } from '../../lib/currencies';
import { Badge, Button, EmptyState, Pagination } from '../../shared/ui';

interface CustomerTableProps {
  filteredCustomers: Customer[];
  paginatedCustomers: Customer[];
  appSettings: any;
  canManageCustomers: boolean;
  currentPage: number;
  totalPages: number;
  ITEMS_PER_PAGE: number;
  setCurrentPage: (val: number | ((prev: number) => number)) => void;
  setPageSize: (val: number) => void;
  handleViewCustomer: (customer: Customer) => void;
  handleEditCustomer: (customer: Customer) => void;
  handleDeleteCustomer: (id: string) => void;
  handleWhatsAppRedirect: (phone: string) => void;
  getCustomerTotalPurchases: (id: string, total: number | undefined) => number;
}

export function CustomerTable({
  filteredCustomers,
  paginatedCustomers,
  appSettings,
  canManageCustomers,
  currentPage,
  totalPages,
  ITEMS_PER_PAGE,
  setCurrentPage,
  setPageSize,
  handleViewCustomer,
  handleEditCustomer,
  handleDeleteCustomer,
  handleWhatsAppRedirect,
  getCustomerTotalPurchases
}: CustomerTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto scrollbar-hide">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-white/[0.02]">
              <th className="p-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest">{"Customer Info"}</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest">{"Contact"}</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest text-right">{"Total Purchases"}</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest text-center">{"Last Purchase"}</th>
              <th className="p-4 text-[10px] font-black uppercase text-gray-600 dark:text-gray-400 tracking-widest text-right">{"Actions"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-20 text-center">
                  <EmptyState
                    icon={<User className="h-12 w-12 text-gray-600" />}
                    title={"No customers found"}
                    className="!p-0 !opacity-20"
                  />
                </td>
              </tr>
            ) : (
              paginatedCustomers.map((customer: Customer) => (
                <tr key={customer.id} className="group hover:bg-gray-50 dark:hover:bg-white/[0.01] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase leading-none">{customer.name}</p>
                        </div>
                        <p className="text-[9px] text-gray-600 dark:text-gray-400 font-bold mt-1 uppercase tracking-widest">ID: {customer.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-xs font-black text-gray-900 dark:text-white truncate max-w-[200px]">{customer.phone || 'NO PHONE'}</p>
                    <p className="text-[9px] text-gray-600 dark:text-gray-400 font-medium truncate max-w-[200px] mt-0.5 uppercase tracking-tighter">{customer.email || 'no-email@store.com'}</p>
                  </td>
                  <td className="p-4 text-right font-black text-primary dark:text-emerald-400 text-sm">
                    {formatCurrency(getCustomerTotalPurchases(customer.id, customer.totalPurchases), appSettings.currency)}
                  </td>
                  <td className="p-4 text-center">
                    <Badge tone="neutral" size="sm">
                      {customer.lastPurchase ? formatAppDate(customer.lastPurchase, appSettings.country) : "NEVER"}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end items-center gap-2 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        onClick={() => handleViewCustomer(customer)}
                        aria-label="View customer"
                        className="!min-h-0 !p-2 !rounded-xl !bg-blue-50 dark:!bg-blue-500/10 !text-blue-600 hover:!scale-110 active:!scale-95"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => customer.phone && handleWhatsAppRedirect(customer.phone)}
                        disabled={!customer.phone}
                        aria-label="Send WhatsApp message"
                        className="!min-h-0 !p-2 !rounded-xl !bg-emerald-50 dark:!bg-primary/10 !text-primary hover:!scale-110 active:!scale-95 disabled:!opacity-30"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleEditCustomer(customer)}
                        aria-label="Edit customer"
                        className="!min-h-0 !p-2 !rounded-xl !bg-amber-50 dark:!bg-amber-500/10 !text-amber-600 hover:!scale-110 active:!scale-95"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteCustomer(customer.id)}
                        disabled={!canManageCustomers}
                        aria-label="Delete customer"
                        className="!min-h-0 !p-2 !rounded-xl !bg-red-50 dark:!bg-red-500/10 !text-red-600 hover:!scale-110 active:!scale-95 disabled:!opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (Expert Density) */}
      <div className="lg:hidden p-3 sm:p-4">
        {filteredCustomers.length === 0 ? (
          <EmptyState
            icon={<User className="h-10 w-10 text-gray-600 opacity-10" />}
            title={"No customers found"}
            className="!py-10"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
            {paginatedCustomers.map((customer: Customer) => (
              <div
                key={customer.id}
                onClick={() => handleViewCustomer(customer)}
                className="relative flex flex-col p-3 sm:p-4 rounded-[1.5rem] bg-white dark:bg-surface border border-gray-200 dark:border-white/5 shadow-sm active:scale-[0.98] transition-all"
              >
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-2">
                    <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); if (customer.phone) handleWhatsAppRedirect(customer.phone); }}
                        aria-label="Send WhatsApp message"
                        className="!min-h-0 !p-1.5 !rounded-lg !bg-emerald-50 dark:!bg-primary/10 !text-primary"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleEditCustomer(customer); }}
                        aria-label="Edit customer"
                        className="!min-h-0 !p-1.5 !rounded-lg !bg-amber-50 dark:!bg-amber-500/10 !text-amber-600"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                        disabled={!canManageCustomers}
                        aria-label="Delete customer"
                        className="!min-h-0 !p-1.5 !rounded-lg !bg-red-50 dark:!bg-red-500/10 !text-red-600 disabled:!opacity-40"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  <h3 className="font-black text-gray-900 dark:text-white uppercase text-[10px] leading-tight truncate mb-1">
                    {customer.name}
                  </h3>
                  <p className="text-[8px] text-gray-600 dark:text-gray-400 font-bold uppercase tracking-tight mb-3 truncate">
                    {customer.phone || 'NO PHONE'}
                  </p>

                  <div className="mt-auto pt-2 border-t border-gray-200 dark:border-white/5 flex items-center justify-between">
                    <p className="text-[11px] font-black text-primary dark:text-emerald-400">
                      {formatCurrency(getCustomerTotalPurchases(customer.id, customer.totalPurchases), appSettings.currency)}
                    </p>
                    <span className="text-[7px] font-black text-gray-600 dark:text-gray-400 uppercase">
                      {customer.lastPurchase ? formatAppDate(customer.lastPurchase, appSettings.country).substring(0, 6) : 'NEVER'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Premium Pagination Footer */}
      
      <div className="p-4 bg-gray-50/50 dark:bg-white/[0.02] border-t border-gray-200 dark:border-white/5 flex items-center justify-between gap-4">
        <p className="hidden sm:block text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase tracking-widest italic truncate">{"Records"} {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredCustomers.length)} {"of"} {filteredCustomers.length}</p>
        <div className="mx-auto sm:mx-0">
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredCustomers.length}
            onPageChange={setCurrentPage}
            siblingCount={1}
            pageSize={ITEMS_PER_PAGE}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>
    </>
  );
}
